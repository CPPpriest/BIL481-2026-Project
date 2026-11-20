/**
 * Client for `POST /api/v1/chat/stream` (API Contract v1.1 §3.3, UC-04).
 *
 * - Sends `{ message }` with the student's JWT; chat always requires login
 *   (contract §1 "Chat access"), so without a token no request is made.
 * - Reads the `text/event-stream` body with fetch + SseParser and reports
 *   every state change through `onUpdate`, so the UI can show text as it
 *   arrives and one badge per tool invocation (FR-17).
 * - Shows a "still processing" flag when no answer text arrives within
 *   `processingNoticeMs` (5 s) and cancels when nothing at all arrives for
 *   `idleTimeoutMs` (20 s) (Design Document UC-04, FR-19).
 * - Never reconnects or resends on its own: re-running a half-finished tool
 *   chain without server replay is prohibited (contract §3.3). The UI offers
 *   an explicit retry instead.
 */
import { parseChatFrame } from './chatEvents';
import { SseParser } from './sseParser';
import {
  applyChatEvent,
  failChatTurn,
  initialChatTurn,
  type ChatError,
  type ChatErrorCode,
  type ChatTurnState,
} from './chatTurn';

/** Anything with the `fetch` signature: the browser fetch or a fake transport. */
export type ChatTransport = (input: string, init: RequestInit) => Promise<Response>;

export interface ChatStreamClientOptions {
  transport: ChatTransport;
  /** Empty = same origin; Next.js rewrites /api/v1/* to the gateway. */
  baseUrl?: string;
  processingNoticeMs?: number;
  idleTimeoutMs?: number;
}

export interface SendChatOptions {
  /** Mock-SSO JWT of the logged-in student. Required. */
  token: string | null | undefined;
  signal?: AbortSignal;
  /** Called with a new state object after every change. */
  onUpdate?: (state: ChatTurnState) => void;
}

export interface ChatStreamClient {
  send(message: string, options: SendChatOptions): Promise<ChatTurnState>;
}

export const CHAT_STREAM_PATH = '/api/v1/chat/stream';
export const DEFAULT_PROCESSING_NOTICE_MS = 5_000;
export const DEFAULT_IDLE_TIMEOUT_MS = 20_000;
export const MAX_MESSAGE_LENGTH = 1_000;

const GATEWAY_ERROR_CODES: readonly ChatErrorCode[] = [
  'INVALID_PARAMS',
  'AUTHENTICATION_REQUIRED',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'DOWNSTREAM_ERROR',
  'UPSTREAM_TIMEOUT',
  'INTERNAL_ERROR',
];

const MESSAGES: Record<ChatErrorCode, string> = {
  INVALID_PARAMS: 'Mesaj gönderilemedi: geçersiz istek.',
  AUTHENTICATION_REQUIRED: 'Asistanı kullanmak için giriş yapmalısın.',
  RATE_LIMITED: 'Çok fazla istek gönderildi.',
  UPSTREAM_UNAVAILABLE: 'Kampüs servislerine şu an ulaşılamıyor.',
  DOWNSTREAM_ERROR: 'Asistana şu an ulaşılamıyor.',
  UPSTREAM_TIMEOUT: 'Asistan zamanında cevap vermedi.',
  INTERNAL_ERROR: 'Beklenmeyen bir hata oluştu.',
  AGENT_ERROR: 'Asistan cevap üretirken bir hata oluştu.',
  NETWORK_ERROR: 'Sunucuya ulaşılamadı. Bağlantını kontrol et.',
  CLIENT_TIMEOUT: 'Asistan 20 saniye içinde cevap vermedi; istek iptal edildi.',
  STREAM_INTERRUPTED: 'Bağlantı cevap tamamlanmadan koptu.',
  PROTOCOL_ERROR: 'Sunucudan beklenmeyen bir cevap geldi.',
  INVALID_RESPONSE: 'Sunucudan beklenmeyen bir cevap geldi.',
  ABORTED: 'İstek iptal edildi.',
};

function chatError(code: ChatErrorCode, extra: Partial<ChatError> = {}): ChatError {
  return { code, message: MESSAGES[code], ...extra };
}

export function createChatStreamClient({
  transport,
  baseUrl = '',
  processingNoticeMs = DEFAULT_PROCESSING_NOTICE_MS,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
}: ChatStreamClientOptions): ChatStreamClient {
  async function send(message: string, { token, signal, onUpdate }: SendChatOptions): Promise<ChatTurnState> {
    let state = initialChatTurn();
    const update = (next: ChatTurnState) => {
      if (next === state) return;
      state = next;
      onUpdate?.(state);
    };
    // A function (not an inline check) because `update` changes `state` between reads.
    const isOpen = () => state.phase === 'connecting' || state.phase === 'streaming';
    onUpdate?.(state);

    const text = message.trim();
    if (text.length === 0 || text.length > MAX_MESSAGE_LENGTH) {
      update(failChatTurn(state, chatError('INVALID_PARAMS', { message: `Mesaj 1 ile ${MAX_MESSAGE_LENGTH} karakter arasında olmalı.` })));
      return state;
    }
    if (!token) {
      update(failChatTurn(state, chatError('AUTHENTICATION_REQUIRED')));
      return state;
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener('abort', abortFromCaller, { once: true });

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, idleTimeoutMs);
    };
    // "Still processing" until the first answer text arrives.
    const slowTimer = setTimeout(() => {
      if (state.text === '' && isOpen()) {
        update({ ...state, slow: true });
      }
    }, processingNoticeMs);
    resetIdleTimer();

    const failFromException = () => {
      if (timedOut) return chatError('CLIENT_TIMEOUT');
      if (signal?.aborted) return chatError('ABORTED');
      return chatError(state.phase === 'streaming' ? 'STREAM_INTERRUPTED' : 'NETWORK_ERROR');
    };

    try {
      let response: Response;
      try {
        response = await transport(`${baseUrl}${CHAT_STREAM_PATH}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: text }),
          signal: controller.signal,
        });
      } catch {
        update(failChatTurn(state, failFromException()));
        return state;
      }

      if (!response.ok) {
        update(failChatTurn(state, await errorFromResponse(response)));
        return state;
      }
      const contentType = response.headers.get('Content-Type') ?? '';
      if (!contentType.includes('text/event-stream') || response.body === null) {
        update(failChatTurn(state, chatError('INVALID_RESPONSE', { status: response.status })));
        return state;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseParser();
      try {
        while (isOpen()) {
          const { done, value } = await reader.read();
          if (done) break;
          resetIdleTimer();
          for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
            const parsed = parseChatFrame(frame);
            if (parsed.kind === 'event') update(applyChatEvent(state, parsed.event));
            else if (parsed.kind === 'invalid') update(failChatTurn(state, chatError('PROTOCOL_ERROR')));
            if (!isOpen()) break;
          }
        }
      } catch {
        update(failChatTurn(state, failFromException()));
      } finally {
        parser.end();
        // Stop reading once the answer is final (or failed); ignore anything after `done`.
        reader.cancel().catch(() => undefined);
      }

      if (isOpen()) {
        update(failChatTurn(state, chatError('STREAM_INTERRUPTED')));
      }
      return state;
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(idleTimer);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  return { send };
}

/** Maps a non-2xx answer (rejected before streaming) to a chat error (contract §3.4). */
async function errorFromResponse(response: Response): Promise<ChatError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // A non-JSON 5xx usually means the gateway behind the Next.js rewrite is unreachable.
    return chatError(response.status >= 500 ? 'NETWORK_ERROR' : 'INVALID_RESPONSE', { status: response.status });
  }

  const error = (body as { ok?: unknown; error?: { code?: unknown } } | null)?.error;
  const code = error?.code as ChatErrorCode | undefined;
  if ((body as { ok?: unknown } | null)?.ok !== false || code === undefined || !GATEWAY_ERROR_CODES.includes(code)) {
    return chatError('INVALID_RESPONSE', { status: response.status });
  }

  const result = chatError(code, { status: response.status });
  const retryAfter = Number(response.headers.get('Retry-After'));
  if (response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
    result.retryAfterSeconds = retryAfter;
  }
  return result;
}
