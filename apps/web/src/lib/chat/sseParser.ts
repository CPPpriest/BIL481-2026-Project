/**
 * Incremental Server-Sent Events parser (WHATWG "text/event-stream" format).
 *
 * The browser's EventSource cannot send a POST body or an Authorization
 * header, so the chat client reads the `fetch()` response stream itself
 * (API Contract v1.1 §1 "Streaming") and feeds the decoded text into this
 * parser. Network chunks can split a frame anywhere — inside a field name,
 * between "\r" and "\n", or in the middle of a multi-byte character (the
 * caller decodes with `TextDecoder({ stream: true })` for that) — so the
 * parser keeps the unfinished line between calls.
 */

export interface SseMessage {
  /** Value of the `event:` field; "message" when the frame has none. */
  event: string;
  /** All `data:` lines of the frame joined with "\n". */
  data: string;
}

export class SseParser {
  private buffer = '';
  private eventName = '';
  private dataLines: string[] = [];
  private pendingCarriageReturn = false;

  /** Adds decoded text and returns every frame completed by it. */
  push(text: string): SseMessage[] {
    const messages: SseMessage[] = [];
    let input = text;

    // A "\r" at the end of the previous chunk may be the first half of "\r\n".
    if (this.pendingCarriageReturn) {
      this.pendingCarriageReturn = false;
      if (input.startsWith('\n')) input = input.slice(1);
    }

    this.buffer += input;
    let start = 0;
    for (let index = 0; index < this.buffer.length; index += 1) {
      const char = this.buffer[index];
      if (char !== '\n' && char !== '\r') continue;

      const line = this.buffer.slice(start, index);
      if (char === '\r') {
        if (index + 1 === this.buffer.length) {
          this.pendingCarriageReturn = true;
        } else if (this.buffer[index + 1] === '\n') {
          index += 1;
        }
      }
      start = index + 1;

      const message = this.processLine(line);
      if (message) messages.push(message);
    }
    this.buffer = this.buffer.slice(start);
    return messages;
  }

  /**
   * Called when the stream ends. Per the SSE specification an unterminated
   * final frame is discarded, so a stream cut in the middle of a frame never
   * produces a half-received event.
   */
  end(): void {
    this.buffer = '';
    this.eventName = '';
    this.dataLines = [];
    this.pendingCarriageReturn = false;
  }

  private processLine(line: string): SseMessage | null {
    if (line === '') {
      // Blank line: dispatch the frame collected so far.
      if (this.dataLines.length === 0) {
        this.eventName = '';
        return null;
      }
      const message: SseMessage = { event: this.eventName || 'message', data: this.dataLines.join('\n') };
      this.eventName = '';
      this.dataLines = [];
      return message;
    }
    if (line.startsWith(':')) return null; // comment / keep-alive

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') this.eventName = value;
    else if (field === 'data') this.dataLines.push(value);
    // `id` and `retry` are ignored: the client never auto-resumes (contract §3.3).
    return null;
  }
}
