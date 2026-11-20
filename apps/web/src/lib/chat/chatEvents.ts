/**
 * Chat stream events, exactly as defined in API Contract v1.1 §3.3, and a
 * validator that turns a raw SSE frame into one of them.
 */
import type { SseMessage } from './sseParser';

/** Execution status of one tool invocation (same values as `meta.source`). */
export type ToolStatus = 'LIVE' | 'CACHE_HIT' | 'STALE' | 'ERROR';

/** `event: tool` — one per actual tool invocation. */
export interface ToolEvent {
  type: 'tool';
  toolName: string;
  status: ToolStatus;
  durationMs: number;
}

/** `event: token` — an arbitrary chunk of answer text, in arrival order. */
export interface TokenEvent {
  type: 'token';
  text: string;
}

/** `event: done` — exactly once, authoritative final answer. */
export interface DoneEvent {
  type: 'done';
  answer: string;
  toolsInvoked: string[];
  isComplete: boolean;
}

/** `event: error` — failure after the stream started. */
export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export type ChatEvent = ToolEvent | TokenEvent | DoneEvent | ErrorEvent;

const TOOL_STATUSES: readonly ToolStatus[] = ['LIVE', 'CACHE_HIT', 'STALE', 'ERROR'];

export type ParsedFrame =
  | { kind: 'event'; event: ChatEvent }
  /** Event names outside the contract are ignored (forward compatibility). */
  | { kind: 'ignored' }
  /** A contract event whose data is malformed; the stream cannot be trusted any more. */
  | { kind: 'invalid'; reason: string };

export function parseChatFrame(message: SseMessage): ParsedFrame {
  if (!['tool', 'token', 'done', 'error'].includes(message.event)) {
    return { kind: 'ignored' };
  }

  let data: unknown;
  try {
    data = JSON.parse(message.data);
  } catch {
    return { kind: 'invalid', reason: `"${message.event}" data is not valid JSON` };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { kind: 'invalid', reason: `"${message.event}" data is not an object` };
  }
  const value = data as Record<string, unknown>;

  switch (message.event) {
    case 'tool':
      if (
        typeof value.toolName === 'string' &&
        TOOL_STATUSES.includes(value.status as ToolStatus) &&
        typeof value.durationMs === 'number' &&
        value.durationMs >= 0
      ) {
        return {
          kind: 'event',
          event: { type: 'tool', toolName: value.toolName, status: value.status as ToolStatus, durationMs: value.durationMs },
        };
      }
      return { kind: 'invalid', reason: '"tool" event needs toolName, a valid status and durationMs' };

    case 'token':
      return typeof value.text === 'string'
        ? { kind: 'event', event: { type: 'token', text: value.text } }
        : { kind: 'invalid', reason: '"token" event needs text' };

    case 'done':
      if (
        typeof value.answer === 'string' &&
        Array.isArray(value.toolsInvoked) &&
        value.toolsInvoked.every((name) => typeof name === 'string') &&
        typeof value.isComplete === 'boolean'
      ) {
        return {
          kind: 'event',
          event: { type: 'done', answer: value.answer, toolsInvoked: value.toolsInvoked as string[], isComplete: value.isComplete },
        };
      }
      return { kind: 'invalid', reason: '"done" event needs answer, toolsInvoked and isComplete' };

    default:
      return typeof value.code === 'string' && typeof value.message === 'string'
        ? { kind: 'event', event: { type: 'error', code: value.code, message: value.message } }
        : { kind: 'invalid', reason: '"error" event needs code and message' };
  }
}
