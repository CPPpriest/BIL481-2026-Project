import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendGatewayError } from '../http/errorResponse.js';

export interface ChatStreamProxyOptions {
  agentStreamUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const MAX_MESSAGE_LENGTH = 1_000;
const FORBIDDEN_IDENTITY_KEYS = new Set(['studentid', 'student_id', 'userid']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatSseErrorEvent(code: string, message: string): string {
  return `event: error\ndata: ${JSON.stringify({ code, message })}\n\n`;
}

/**
 * Proxies `POST /api/v1/chat/stream` to the internal agent SSE endpoint (Contract v1.1 §1, §3.3, §8 Q4).
 *
 * Security & Streaming Rules:
 * - Always requires a verified student JWT (Contract §1 "Chat access").
 * - Rejects client-supplied studentId/userId keys with 400 INVALID_PARAMS.
 * - Never forwards raw Authorization headers; only forwards X-Authenticated-* from gateway verification.
 * - Pre-header errors return Contract §3.4 JSON; post-header errors emit SSE `event: error` frames.
 * - Never auto-retries failed or aborted streams.
 */
export async function handleChatStream(
  request: FastifyRequest,
  reply: FastifyReply,
  options: ChatStreamProxyOptions
): Promise<void> {
  const { agentStreamUrl, timeoutMs = 20_000, fetchImpl = fetch } = options;

  if (!request.authContext.isAuthenticated || !request.authContext.studentId) {
    sendGatewayError(
      reply,
      401,
      'AUTHENTICATION_REQUIRED',
      'Authentication is required to use the campus assistant.'
    );
    return;
  }

  if (!isPlainRecord(request.body)) {
    sendGatewayError(reply, 400, 'INVALID_PARAMS', 'Request body must be a JSON object.');
    return;
  }

  for (const key of Object.keys(request.body)) {
    if (FORBIDDEN_IDENTITY_KEYS.has(key.toLowerCase())) {
      sendGatewayError(
        reply,
        400,
        'INVALID_PARAMS',
        `Parameter "${key}" is not allowed; identity comes from verified authentication only.`
      );
      return;
    }
  }

  const rawMessage = request.body.message;
  const trimmed = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_LENGTH) {
    sendGatewayError(
      reply,
      400,
      'INVALID_PARAMS',
      `message must be a string between 1 and ${MAX_MESSAGE_LENGTH} characters.`
    );
    return;
  }

  const controller = new AbortController();
  let timedOut = false;
  let clientDisconnected = false;
  let streamCompletedNormally = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onSocketClose = () => {
    if (!streamCompletedNormally) {
      clientDisconnected = true;
      controller.abort();
    }
  };
  reply.raw.once('close', onSocketClose);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchImpl(agentStreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-Authenticated-Student-Id': request.authContext.studentId,
        'X-Authenticated-User-Role': request.authContext.role,
      },
      body: JSON.stringify({ message: trimmed }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    reply.raw.off('close', onSocketClose);
    if (clientDisconnected) {
      return;
    }
    if (timedOut || (err instanceof Error && err.name === 'AbortError')) {
      sendGatewayError(reply, 504, 'UPSTREAM_TIMEOUT', 'Assistant request timed out.');
      return;
    }
    sendGatewayError(reply, 502, 'DOWNSTREAM_ERROR', 'Assistant service is unavailable.');
    return;
  }

  if (!upstreamResponse.ok) {
    clearTimeout(timer);
    reply.raw.off('close', onSocketClose);
    await upstreamResponse.body?.cancel().catch(() => undefined);

    if (upstreamResponse.status === 400) {
      sendGatewayError(reply, 400, 'INVALID_PARAMS', 'Assistant rejected invalid input parameters.');
      return;
    }
    if (upstreamResponse.status === 401) {
      sendGatewayError(reply, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required for assistant.');
      return;
    }
    if (upstreamResponse.status === 429) {
      const retryAfter = upstreamResponse.headers.get('retry-after');
      const headers = retryAfter && /^\d+$/.test(retryAfter) ? { 'Retry-After': retryAfter } : undefined;
      sendGatewayError(reply, 429, 'RATE_LIMITED', 'Assistant rate limit reached.', headers);
      return;
    }
    if (upstreamResponse.status === 503) {
      sendGatewayError(reply, 503, 'UPSTREAM_UNAVAILABLE', 'Assistant upstream dependencies are unavailable.');
      return;
    }
    if (upstreamResponse.status === 504) {
      sendGatewayError(reply, 504, 'UPSTREAM_TIMEOUT', 'Assistant upstream request timed out.');
      return;
    }
    sendGatewayError(reply, 502, 'DOWNSTREAM_ERROR', 'Assistant service returned an error.');
    return;
  }

  const contentType = upstreamResponse.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream') || !upstreamResponse.body) {
    clearTimeout(timer);
    reply.raw.off('close', onSocketClose);
    await upstreamResponse.body?.cancel().catch(() => undefined);
    sendGatewayError(
      reply,
      502,
      'DOWNSTREAM_ERROR',
      'Assistant service did not return an event stream.'
    );
    return;
  }

  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const reader = upstreamResponse.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        streamCompletedNormally = true;
        break;
      }
      if (value && value.byteLength > 0 && !reply.raw.destroyed && !reply.raw.writableEnded) {
        reply.raw.write(value);
      }
    }
  } catch {
    if (!clientDisconnected && !reply.raw.destroyed && !reply.raw.writableEnded) {
      const safeMessage = timedOut
        ? 'Assistant response timed out.'
        : 'Assistant stream interrupted.';
      reply.raw.write(formatSseErrorEvent('AGENT_ERROR', safeMessage));
    }
  } finally {
    clearTimeout(timer);
    reply.raw.off('close', onSocketClose);
    await reader.cancel().catch(() => undefined);
    if (!reply.raw.destroyed && !reply.raw.writableEnded) {
      reply.raw.end();
    }
  }
}
