/**
 * State of one assistant answer (one "chat turn") and the pure reducer that
 * applies stream events to it. The UI renders this state; it never has to
 * interpret raw SSE frames.
 */
import type { ChatEvent, ToolStatus } from './chatEvents';

export interface ToolBadge {
  toolName: string;
  status: ToolStatus;
  durationMs: number;
}

/** Error codes a chat turn can end with. */
export type ChatErrorCode =
  // Gateway JSON errors returned before the stream starts (contract §3.4)
  | 'INVALID_PARAMS'
  | 'AUTHENTICATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'DOWNSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'INTERNAL_ERROR'
  // `event: error` sent by the agent after the stream started (contract §3.3)
  | 'AGENT_ERROR'
  // Detected in the browser
  | 'NETWORK_ERROR'
  | 'CLIENT_TIMEOUT'
  | 'STREAM_INTERRUPTED'
  | 'PROTOCOL_ERROR'
  | 'INVALID_RESPONSE'
  | 'ABORTED';

export interface ChatError {
  code: ChatErrorCode;
  /** Safe, user-readable message. Never contains tokens or stack traces. */
  message: string;
  /** HTTP status when the gateway rejected the request before streaming. */
  status?: number;
  /** Seconds from `Retry-After` on HTTP 429. */
  retryAfterSeconds?: number;
}

export interface ChatTurnState {
  phase: 'connecting' | 'streaming' | 'done' | 'error';
  /** Answer text: streamed chunks while streaming, the authoritative `done.answer` afterwards. */
  text: string;
  /** Exactly one badge per `tool` event, in arrival order (FR-17). */
  tools: ToolBadge[];
  /** Ordered tool list from `done`; null until the answer is complete. */
  toolsInvoked: string[] | null;
  isComplete: boolean;
  /** True while no answer text has arrived for longer than the processing-notice delay (FR-19). */
  slow: boolean;
  error: ChatError | null;
}

export function initialChatTurn(): ChatTurnState {
  return { phase: 'connecting', text: '', tools: [], toolsInvoked: null, isComplete: false, slow: false, error: null };
}

/**
 * Applies one contract event. After `done` or an error the turn is closed and
 * further events are ignored, so a misbehaving stream can never append text
 * after the final answer or produce a second `done`.
 */
export function applyChatEvent(state: ChatTurnState, event: ChatEvent): ChatTurnState {
  if (state.phase === 'done' || state.phase === 'error') return state;

  switch (event.type) {
    case 'tool':
      return {
        ...state,
        phase: 'streaming',
        tools: [...state.tools, { toolName: event.toolName, status: event.status, durationMs: event.durationMs }],
      };
    case 'token':
      return { ...state, phase: 'streaming', text: state.text + event.text, slow: false };
    case 'done':
      return {
        ...state,
        phase: 'done',
        text: event.answer,
        toolsInvoked: event.toolsInvoked,
        isComplete: event.isComplete,
        slow: false,
      };
    case 'error':
      // The UI is Turkish and the agent's message may be English or technical, so a fixed
      // Turkish text is shown; the server text never reaches the screen.
      return {
        ...state,
        phase: 'error',
        slow: false,
        error: { code: 'AGENT_ERROR', message: 'Asistan cevap üretirken bir hata oluştu.' },
      };
  }
}

/** Ends a turn with a client-side or gateway error, keeping any partial answer for display. */
export function failChatTurn(state: ChatTurnState, error: ChatError): ChatTurnState {
  if (state.phase === 'done' || state.phase === 'error') return state;
  return { ...state, phase: 'error', slow: false, error };
}
