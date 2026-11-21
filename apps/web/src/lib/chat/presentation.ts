/**
 * Turkish labels and display rules for the chat UI. Kept separate from the
 * components so they can be unit-tested without a browser.
 */
import type { ToolStatus } from './chatEvents';
import type { ChatError, ChatErrorCode } from './chatTurn';

const TOOL_LABELS: Record<string, string> = {
  get_course_schedule: 'Ders programı',
  get_shuttle_schedule: 'Ring seferleri',
  get_cafeteria_menu: 'Yemekhane menüsü',
  get_library_occupancy: 'Kütüphane doluluğu',
};

/** Unknown tool names are shown as they are, so a new tool is never hidden. */
export function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

const STATUS_LABELS: Record<ToolStatus, string> = {
  LIVE: 'Yeni sorgu',
  CACHE_HIT: 'Önbellekten',
  STALE: 'Eski veri',
  ERROR: 'Hata',
};

export function toolStatusLabel(status: ToolStatus): string {
  return STATUS_LABELS[status];
}

/** User-facing error text, including the wait time for rate limiting. */
export function chatErrorText(error: ChatError): string {
  if (error.code === 'RATE_LIMITED' && error.retryAfterSeconds) {
    return `${error.message} ${error.retryAfterSeconds} saniye sonra tekrar dene.`;
  }
  return error.message;
}

/**
 * Errors where sending the same question again cannot help. A stopped
 * question (ABORTED) can be asked again, so it is not listed here.
 */
const NOT_RETRYABLE: readonly ChatErrorCode[] = ['AUTHENTICATION_REQUIRED', 'INVALID_PARAMS'];

export function canRetry(error: ChatError): boolean {
  return !NOT_RETRYABLE.includes(error.code);
}

/**
 * A 401 from the gateway means the stored token is no longer valid; the
 * session is ended so the user is asked to log in again (FR-15).
 */
export function endsSession(error: ChatError): boolean {
  return error.code === 'AUTHENTICATION_REQUIRED' && error.status === 401;
}
