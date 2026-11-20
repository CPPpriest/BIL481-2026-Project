import { describe, expect, it } from 'vitest';
import { SseParser } from '../src/lib/chat/sseParser';
import { parseChatFrame } from '../src/lib/chat/chatEvents';

describe('SseParser', () => {
  const stream =
    'event: tool\ndata: {"toolName":"get_cafeteria_menu","status":"LIVE","durationMs":15}\n\n' +
    'event: token\ndata: {"text":"Öğle menüsü: çorba"}\n\n' +
    'event: done\ndata: {"answer":"x","toolsInvoked":[],"isComplete":true}\n\n';

  it('parses complete frames delivered in one chunk', () => {
    const messages = new SseParser().push(stream);
    expect(messages.map((message) => message.event)).toEqual(['tool', 'token', 'done']);
    expect(JSON.parse(messages[1]!.data)).toEqual({ text: 'Öğle menüsü: çorba' });
  });

  it('gives the same frames when the text arrives one character at a time', () => {
    const parser = new SseParser();
    const messages = [...stream].flatMap((char) => parser.push(char));
    expect(messages).toEqual(new SseParser().push(stream));
  });

  it('handles CRLF line endings, including "\\r" and "\\n" in different chunks', () => {
    const parser = new SseParser();
    const crlf = stream.replace(/\n/g, '\r\n');
    const half = crlf.indexOf('\r') + 1; // split right after the first "\r"
    const messages = [...parser.push(crlf.slice(0, half)), ...parser.push(crlf.slice(half))];
    expect(messages.map((message) => message.event)).toEqual(['tool', 'token', 'done']);
  });

  it('joins multi-line data, ignores comments and frames without data', () => {
    const messages = new SseParser().push(': keep-alive\n\nevent: token\ndata: line one\ndata: line two\n\nevent: ping\n\n');
    expect(messages).toEqual([{ event: 'token', data: 'line one\nline two' }]);
  });

  it('uses "message" as the event name when none is given', () => {
    expect(new SseParser().push('data: hi\n\n')).toEqual([{ event: 'message', data: 'hi' }]);
  });

  it('discards an unterminated last frame when the stream ends', () => {
    const parser = new SseParser();
    expect(parser.push('event: token\ndata: {"text":"half"}\n')).toEqual([]);
    parser.end();
    expect(parser.push('\n')).toEqual([]);
  });
});

describe('parseChatFrame (API Contract v1.1 §3.3)', () => {
  it('accepts the four contract events', () => {
    expect(parseChatFrame({ event: 'tool', data: '{"toolName":"get_shuttle_schedule","status":"CACHE_HIT","durationMs":4}' })).toEqual({
      kind: 'event',
      event: { type: 'tool', toolName: 'get_shuttle_schedule', status: 'CACHE_HIT', durationMs: 4 },
    });
    expect(parseChatFrame({ event: 'token', data: '{"text":"a"}' }).kind).toBe('event');
    expect(parseChatFrame({ event: 'done', data: '{"answer":"a","toolsInvoked":["x"],"isComplete":true}' }).kind).toBe('event');
    expect(parseChatFrame({ event: 'error', data: '{"code":"AGENT_ERROR","message":"m"}' }).kind).toBe('event');
  });

  it('ignores unknown event names', () => {
    expect(parseChatFrame({ event: 'progress', data: '{}' })).toEqual({ kind: 'ignored' });
  });

  it('rejects malformed contract events', () => {
    expect(parseChatFrame({ event: 'token', data: '{not json}' }).kind).toBe('invalid');
    expect(parseChatFrame({ event: 'tool', data: '{"toolName":"x","status":"MOCK","durationMs":1}' }).kind).toBe('invalid');
    expect(parseChatFrame({ event: 'done', data: '{"answer":"a"}' }).kind).toBe('invalid');
  });
});
