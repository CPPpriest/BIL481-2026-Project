import crypto from 'node:crypto';
import { TOOL_NAMES, type ToolName } from '@campus-orchestrator/shared';
import { buildGatewayError, type GatewayErrorBody, type GatewayErrorCode } from '../http/errorResponse.js';
import type { AuthenticatedRequestContext } from '../types/auth.js';

export type DataSource = 'LIVE' | 'CACHE_HIT' | 'STALE' | 'ERROR';

export interface ResponseMeta {
  isSimulated: boolean;
  isStale: boolean;
  source: DataSource;
  timestamp: string;
  durationMs?: number;
}

export interface QuerySuccessBody {
  ok: true;
  toolName: ToolName;
  data: unknown;
  meta: ResponseMeta;
}

export type ProxyQueryResult =
  | { ok: true; statusCode: 200; body: QuerySuccessBody }
  | { ok: false; statusCode: number; code: GatewayErrorCode; message: string; body: GatewayErrorBody };

export interface ForwardToolQueryOptions {
  toolName: unknown;
  parameters: unknown;
  authContext: AuthenticatedRequestContext;
  mcpUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

const VALID_TOOL_NAMES: readonly string[] = Object.values(TOOL_NAMES);
const FORBIDDEN_IDENTITY_KEYS = new Set(['studentid', 'student_id', 'userid']);
const VALID_SUCCESS_SOURCES = new Set<DataSource>(['LIVE', 'CACHE_HIT', 'STALE']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyPlainObject(value: unknown): boolean {
  return isPlainRecord(value) && Object.keys(value).length === 0;
}

function containsForbiddenIdentityKey(parameters: Record<string, unknown>): string | undefined {
  for (const key of Object.keys(parameters)) {
    if (FORBIDDEN_IDENTITY_KEYS.has(key.toLowerCase())) {
      return key;
    }
  }
  return undefined;
}

function errorResult(
  statusCode: number,
  code: GatewayErrorCode,
  message: string,
  now: Date
): ProxyQueryResult {
  return {
    ok: false,
    statusCode,
    code,
    message,
    body: buildGatewayError(code, message, now),
  };
}

function mapCodeToHttpError(
  rawCode: unknown,
  rawMessage: unknown,
  now: Date
): ProxyQueryResult {
  const safeMessage =
    typeof rawMessage === 'string' && rawMessage.trim().length > 0
      ? rawMessage.trim()
      : 'Campus tool execution failed.';

  if (rawCode === -32602 || rawCode === -32601 || rawCode === 'INVALID_PARAMS') {
    return errorResult(400, 'INVALID_PARAMS', safeMessage, now);
  }
  if (rawCode === -32001 || rawCode === 'AUTHENTICATION_REQUIRED') {
    return errorResult(401, 'AUTHENTICATION_REQUIRED', safeMessage, now);
  }
  if (rawCode === 'UPSTREAM_TIMEOUT' || rawCode === 'TIMEOUT') {
    return errorResult(504, 'UPSTREAM_TIMEOUT', 'Campus upstream service timed out.', now);
  }
  if (
    rawCode === 'UPSTREAM_ERROR' ||
    rawCode === 'UPSTREAM_UNAVAILABLE' ||
    rawCode === 'CIRCUIT_OPEN' ||
    rawCode === 'NOT_IMPLEMENTED'
  ) {
    return errorResult(
      503,
      'UPSTREAM_UNAVAILABLE',
      'The requested campus service is currently unavailable.',
      now
    );
  }
  return errorResult(502, 'DOWNSTREAM_ERROR', 'Downstream MCP service returned an error.', now);
}

/**
 * Validates a direct /api/v1/query request, forwards it as JSON-RPC 2.0 `tools/call`
 * to the internal MCP server without any raw JWT, and normalizes the response envelope
 * per API Contract v1.1 §3.2, §3.4, and §4.
 */
export async function forwardToolQuery({
  toolName,
  parameters,
  authContext,
  mcpUrl,
  timeoutMs = 10_000,
  fetchImpl = fetch,
  now = () => new Date(),
}: ForwardToolQueryOptions): Promise<ProxyQueryResult> {
  const requestStartMs = Date.now();
  const currentNow = now();

  if (typeof toolName !== 'string' || !VALID_TOOL_NAMES.includes(toolName)) {
    return errorResult(400, 'INVALID_PARAMS', 'Unknown or missing toolName.', currentNow);
  }

  const normalizedParams = parameters === undefined ? {} : parameters;
  if (!isPlainRecord(normalizedParams)) {
    return errorResult(400, 'INVALID_PARAMS', 'parameters must be a JSON object.', currentNow);
  }

  const forbiddenKey = containsForbiddenIdentityKey(normalizedParams);
  if (forbiddenKey) {
    return errorResult(
      400,
      'INVALID_PARAMS',
      `Parameter "${forbiddenKey}" is not allowed; identity comes from verified authentication only.`,
      currentNow
    );
  }

  if (toolName === TOOL_NAMES.COURSE_SCHEDULE && (!authContext.isAuthenticated || !authContext.studentId)) {
    return errorResult(
      401,
      'AUTHENTICATION_REQUIRED',
      'Authentication required for personal course schedule lookup.',
      currentNow
    );
  }

  const outboundHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (authContext.isAuthenticated && authContext.studentId) {
    outboundHeaders['X-Authenticated-Student-Id'] = authContext.studentId;
    outboundHeaders['X-Authenticated-User-Role'] = authContext.role;
  }

  const rpcRequest = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: normalizedParams,
    },
  };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchImpl(mcpUrl, {
      method: 'POST',
      headers: outboundHeaders,
      body: JSON.stringify(rpcRequest),
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut || (err instanceof Error && err.name === 'AbortError')) {
      return errorResult(504, 'UPSTREAM_TIMEOUT', 'Campus tool request timed out.', now());
    }
    return errorResult(502, 'DOWNSTREAM_ERROR', 'Downstream MCP service is unavailable.', now());
  } finally {
    clearTimeout(timer);
  }

  if (upstreamResponse.status === 401) {
    return errorResult(
      401,
      'AUTHENTICATION_REQUIRED',
      'Authentication required for the requested campus tool.',
      now()
    );
  }

  if (upstreamResponse.status >= 500) {
    return errorResult(502, 'DOWNSTREAM_ERROR', 'Downstream MCP service is unavailable.', now());
  }

  let rpcPayload: unknown;
  try {
    rpcPayload = await upstreamResponse.json();
  } catch {
    return errorResult(502, 'DOWNSTREAM_ERROR', 'Invalid response received from MCP service.', now());
  }

  if (!isPlainRecord(rpcPayload)) {
    return errorResult(502, 'DOWNSTREAM_ERROR', 'Malformed JSON-RPC response from MCP service.', now());
  }

  if ('error' in rpcPayload && rpcPayload.error !== undefined && rpcPayload.error !== null) {
    const rpcErr = isPlainRecord(rpcPayload.error) ? rpcPayload.error : {};
    return mapCodeToHttpError(rpcErr.code, rpcErr.message, now());
  }

  if (!upstreamResponse.ok) {
    return errorResult(502, 'DOWNSTREAM_ERROR', 'Downstream MCP service rejected the request.', now());
  }

  const result = rpcPayload.result;
  if (!isPlainRecord(result)) {
    return errorResult(502, 'DOWNSTREAM_ERROR', 'Downstream MCP response is missing result data.', now());
  }

  if (result.isError === true) {
    const contentText =
      Array.isArray(result.content) &&
      isPlainRecord(result.content[0]) &&
      typeof result.content[0].text === 'string'
        ? result.content[0].text
        : undefined;
    const errCode = result.code ?? (isPlainRecord(result.error) ? result.error.code : 'UPSTREAM_UNAVAILABLE');
    return mapCodeToHttpError(errCode, result.message ?? contentText, now());
  }

  if (!Array.isArray(result.content)) {
    return errorResult(502, 'DOWNSTREAM_ERROR', 'Downstream MCP response did not include content blocks.', now());
  }

  const jsonBlock = result.content.find(
    (block): block is Record<string, unknown> =>
      isPlainRecord(block) && block.type === 'json' && 'data' in block
  );

  if (!jsonBlock) {
    return errorResult(
      502,
      'DOWNSTREAM_ERROR',
      'Downstream MCP response did not include structured data.',
      now()
    );
  }

  const data = jsonBlock.data;
  if (data === null || typeof data !== 'object' || isEmptyPlainObject(data)) {
    return errorResult(
      502,
      'DOWNSTREAM_ERROR',
      'Downstream MCP response returned empty or invalid domain data.',
      now()
    );
  }

  const isStale = Boolean(jsonBlock.isStale ?? result.isStale ?? false);
  const rawSource = jsonBlock.source ?? result.source ?? (isStale ? 'STALE' : 'LIVE');

  if (rawSource === 'ERROR') {
    return errorResult(
      503,
      'UPSTREAM_UNAVAILABLE',
      'The requested campus service is currently unavailable.',
      now()
    );
  }

  const source: DataSource =
    typeof rawSource === 'string' && VALID_SUCCESS_SOURCES.has(rawSource as DataSource)
      ? (rawSource as DataSource)
      : isStale
        ? 'STALE'
        : 'LIVE';

  const dataSimulated =
    isPlainRecord(data) && typeof data.isSimulated === 'boolean' ? data.isSimulated : undefined;
  const rawIsSimulated = jsonBlock.isSimulated ?? result.isSimulated ?? dataSimulated ?? false;
  const isSimulated = Boolean(rawIsSimulated);

  const rawTimestamp = jsonBlock.timestamp ?? result.timestamp;
  const timestamp =
    typeof rawTimestamp === 'string' && rawTimestamp.trim().length > 0
      ? rawTimestamp
      : now().toISOString();

  const rawDuration = jsonBlock.durationMs ?? result.durationMs;
  const durationMs =
    typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration >= 0
      ? rawDuration
      : Math.max(0, Date.now() - requestStartMs);

  return {
    ok: true,
    statusCode: 200,
    body: {
      ok: true,
      toolName: toolName as ToolName,
      data,
      meta: {
        isSimulated,
        isStale,
        source,
        timestamp,
        durationMs,
      },
    },
  };
}
