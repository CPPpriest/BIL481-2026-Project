/**
 * Fake `POST /api/v1/chat/stream` for UI work and tests while the real agent
 * stream (M-04, S-03) does not exist yet. It produces exactly the frames of
 * API Contract v1.1 §3.3 as a real streaming `Response`.
 *
 * IMPORTANT: this is not the agent. Its answer is a fixed synthetic text; no
 * tool or LLM is called. A run with this transport never counts as an
 * acceptance result for UC-04 (Acceptance Tests document §2.5).
 */
import type { ChatTransport } from './chatStreamClient';

export type FakeChatScenario =
  | 'success'
  | 'slow'
  | 'agent-error'
  | 'interrupted'
  | 'invalid-frame'
  | 'unauthorized'
  | 'rate-limited';

export const FAKE_CHAT_SCENARIOS: readonly FakeChatScenario[] = [
  'success',
  'slow',
  'agent-error',
  'interrupted',
  'invalid-frame',
  'unauthorized',
  'rate-limited',
];

export interface FakeChatTransportOptions {
  scenario?: FakeChatScenario;
  /** Delay between network chunks; 0 in tests. */
  chunkDelayMs?: number;
  /** Delay before the first frame in the "slow" scenario. */
  slowStartMs?: number;
  /** Size of each network chunk in bytes; small values split frames and multi-byte characters. */
  chunkBytes?: number;
}

/** Synthetic tool results the fixed answer is based on (marked synthetic in the text). */
export const FAKE_TOOL_EVENTS = [
  { toolName: 'get_course_schedule', status: 'LIVE', durationMs: 25 },
  { toolName: 'get_shuttle_schedule', status: 'CACHE_HIT', durationMs: 4 },
  { toolName: 'get_cafeteria_menu', status: 'LIVE', durationMs: 15 },
] as const;

export const FAKE_ANSWER =
  "10:30'daki BIL481 dersin 12:20'de bitiyor. Ana Ring'in sonraki seferi 12:30'da; durağa yürüyerek yetişebilirsin. " +
  'Öğle menüsünde Mercimek Çorbası, Tavuk Sote ve Pirinç Pilavı var. (Örnek veri: sentetik ders, ring ve menü bilgisi.)';

export function createFakeChatTransport({
  scenario = 'success',
  chunkDelayMs = 40,
  slowStartMs = 6_000,
  chunkBytes = 24,
}: FakeChatTransportOptions = {}): ChatTransport {
  return async (_input, init) => {
    const headers = new Headers(init.headers);
    const hasToken = headers.get('Authorization')?.startsWith('Bearer ') ?? false;

    if (scenario === 'unauthorized' || !hasToken) {
      return jsonError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required for the assistant.');
    }
    if (scenario === 'rate-limited') {
      return jsonError(429, 'RATE_LIMITED', 'Too many requests.', { 'Retry-After': '30' });
    }

    const text = buildFrames(scenario);
    const bytes = new TextEncoder().encode(text);
    const signal = init.signal ?? undefined;
    let offset = 0;
    let first = true;

    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const wait = first && scenario === 'slow' ? slowStartMs : chunkDelayMs;
          first = false;
          if (wait > 0) await delay(wait, signal);
          if (offset >= bytes.length) {
            controller.close();
            return;
          }
          controller.enqueue(bytes.slice(offset, offset + chunkBytes));
          offset += chunkBytes;
        } catch (error) {
          controller.error(error);
        }
      },
    });
    signal?.addEventListener('abort', () => body.cancel().catch(() => undefined), { once: true });

    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  };
}

function buildFrames(scenario: FakeChatScenario): string {
  const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const tools = FAKE_TOOL_EVENTS.map((tool) => frame('tool', tool)).join('');
  const chunks = splitIntoChunks(FAKE_ANSWER, 6);
  const tokens = chunks.map((chunk) => frame('token', { text: chunk })).join('');
  const done = frame('done', {
    answer: FAKE_ANSWER,
    toolsInvoked: FAKE_TOOL_EVENTS.map((tool) => tool.toolName),
    isComplete: true,
  });

  switch (scenario) {
    case 'agent-error':
      return (
        tools.slice(0, tools.indexOf('event: tool', 1)) +
        frame('token', { text: chunks[0] }) +
        frame('error', { code: 'AGENT_ERROR', message: 'The assistant could not finish the answer.' })
      );
    case 'interrupted':
      // Ends after part of the answer without `done`, with a half-written last frame.
      return tools + chunks.slice(0, 2).map((chunk) => frame('token', { text: chunk })).join('') + 'event: token\ndata: {"te';
    case 'invalid-frame':
      return tools + 'event: token\ndata: {not json}\n\n' + done;
    default:
      // A keep-alive comment is valid SSE and must be ignored by the client.
      return ': keep-alive\n\n' + tools + tokens + done;
  }
}

function splitIntoChunks(text: string, parts: number): string[] {
  const words = text.split(' ');
  const size = Math.ceil(words.length / parts);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += size) {
    const piece = words.slice(index, index + size).join(' ');
    chunks.push(index + size < words.length ? `${piece} ` : piece);
  }
  return chunks;
}

function jsonError(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message }, timestamp: new Date().toISOString() }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}
