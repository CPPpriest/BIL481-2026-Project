import { describe, expect, it } from 'vitest';
import { CHAT_STREAM_PATH, createChatStreamClient, type ChatTransport } from '../src/lib/chat/chatStreamClient';
import { applyChatEvent, initialChatTurn, type ChatTurnState } from '../src/lib/chat/chatTurn';
import {
  createFakeChatTransport,
  FAKE_ANSWER,
  FAKE_TOOL_EVENTS,
  type FakeChatScenario,
} from '../src/lib/chat/fakeChatTransport';

/**
 * UC-04 chat stream client (FR-17, FR-19) against the frames of
 * API Contract v1.1 §3.3. The fake transport splits the stream into small
 * byte chunks, so frames and multi-byte Turkish characters are cut mid-way.
 */

const TOKEN = 'synthetic-test-token';
const QUESTION = '10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?';

function client(scenario: FakeChatScenario = 'success', extra: Parameters<typeof createFakeChatTransport>[0] = {}, timeouts = {}) {
  return createChatStreamClient({
    transport: createFakeChatTransport({ scenario, chunkDelayMs: 0, chunkBytes: 7, ...extra }),
    ...timeouts,
  });
}

async function sendCollecting(c: ReturnType<typeof client>, options: { token?: string | null; signal?: AbortSignal } = {}) {
  const updates: ChatTurnState[] = [];
  const final = await c.send(QUESTION, {
    token: options.token === undefined ? TOKEN : options.token,
    signal: options.signal,
    onUpdate: (state) => updates.push(state),
  });
  return { final, updates };
}

describe('chat turn reducer', () => {
  it('keeps one badge per tool event, concatenates tokens and closes on done', () => {
    let state = initialChatTurn();
    state = applyChatEvent(state, { type: 'tool', toolName: 'a', status: 'LIVE', durationMs: 1 });
    state = applyChatEvent(state, { type: 'token', text: 'Mer' });
    state = applyChatEvent(state, { type: 'token', text: 'haba' });
    expect(state).toMatchObject({ phase: 'streaming', text: 'Merhaba', tools: [{ toolName: 'a' }] });

    state = applyChatEvent(state, { type: 'done', answer: 'Merhaba!', toolsInvoked: ['a'], isComplete: true });
    const afterDone = applyChatEvent(state, { type: 'token', text: ' extra' });
    const secondDone = applyChatEvent(afterDone, { type: 'done', answer: 'other', toolsInvoked: [], isComplete: true });

    expect(state).toMatchObject({ phase: 'done', text: 'Merhaba!', toolsInvoked: ['a'] });
    expect(secondDone).toBe(state); // nothing changes after done
  });
});

describe('chat stream client — success', () => {
  it('streams the answer, shows one badge per invoked tool and ends with done', async () => {
    const { final, updates } = await sendCollecting(client());

    expect(final.phase).toBe('done');
    expect(final.text).toBe(FAKE_ANSWER);
    expect(final.isComplete).toBe(true);
    expect(final.tools).toEqual(FAKE_TOOL_EVENTS.map((tool) => ({ ...tool })));
    expect(final.toolsInvoked).toEqual(['get_course_schedule', 'get_shuttle_schedule', 'get_cafeteria_menu']);

    // FR-17: text was visible before the answer was complete.
    const partial = updates.find((state) => state.phase === 'streaming' && state.text.length > 0);
    expect(partial).toBeDefined();
    expect(partial!.text.length).toBeLessThan(FAKE_ANSWER.length);
    // done was applied exactly once.
    expect(updates.filter((state) => state.phase === 'done')).toHaveLength(1);
  });

  it('decodes Turkish characters correctly even when bytes are split across chunks', async () => {
    const { final } = await sendCollecting(client('success', { chunkBytes: 1 }));
    expect(final.text).toContain('Öğle menüsünde Mercimek Çorbası');
  });

  it('posts { message } with the bearer token and no identity fields', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const recorder: ChatTransport = (url, init) => {
      seen.push({ url, init });
      return createFakeChatTransport({ chunkDelayMs: 0 })(url, init);
    };
    await createChatStreamClient({ transport: recorder }).send(`  ${QUESTION}  `, { token: TOKEN });

    expect(seen[0]?.url).toBe(CHAT_STREAM_PATH);
    expect(seen[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(seen[0]?.init.body))).toEqual({ message: QUESTION });
    const headers = new Headers(seen[0]?.init.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headers.get('Accept')).toBe('text/event-stream');
    expect([...headers.keys()].some((key) => key.startsWith('x-authenticated'))).toBe(false);
  });
});

describe('chat stream client — rejected before streaming', () => {
  it('does not send anything without a token (chat requires login)', async () => {
    let called = false;
    const spy: ChatTransport = async () => {
      called = true;
      return new Response(null, { status: 500 });
    };
    const final = await createChatStreamClient({ transport: spy }).send(QUESTION, { token: null });

    expect(called).toBe(false);
    expect(final).toMatchObject({ phase: 'error', error: { code: 'AUTHENTICATION_REQUIRED' } });
  });

  it('rejects an empty message locally', async () => {
    const final = await client().send('   ', { token: TOKEN });
    expect(final.error?.code).toBe('INVALID_PARAMS');
  });

  it('maps HTTP 401 and 429 JSON errors, including Retry-After', async () => {
    expect((await sendCollecting(client('unauthorized'))).final.error).toMatchObject({ code: 'AUTHENTICATION_REQUIRED', status: 401 });
    expect((await sendCollecting(client('rate-limited'))).final.error).toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterSeconds: 30,
    });
  });

  it('treats a 200 answer that is not an event stream as invalid', async () => {
    const json: ChatTransport = async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    const final = await createChatStreamClient({ transport: json }).send(QUESTION, { token: TOKEN });
    expect(final.error?.code).toBe('INVALID_RESPONSE');
  });

  it('reports a non-JSON 5xx (gateway unreachable behind the rewrite) as a network error', async () => {
    const down: ChatTransport = async () => new Response('Internal Server Error', { status: 500 });
    const final = await createChatStreamClient({ transport: down }).send(QUESTION, { token: TOKEN });
    expect(final.error).toMatchObject({ code: 'NETWORK_ERROR', status: 500 });
  });
});

describe('chat stream client — failures after streaming started', () => {
  it('ends with AGENT_ERROR on an error event and keeps the partial answer', async () => {
    const { final } = await sendCollecting(client('agent-error'));

    expect(final.phase).toBe('error');
    expect(final.error?.code).toBe('AGENT_ERROR');
    expect(final.tools).toHaveLength(1);
    expect(final.text.length).toBeGreaterThan(0);
  });

  it('reports STREAM_INTERRUPTED when the stream ends without done, and does not retry by itself', async () => {
    let requests = 0;
    const counting: ChatTransport = (url, init) => {
      requests += 1;
      return createFakeChatTransport({ scenario: 'interrupted', chunkDelayMs: 0, chunkBytes: 5 })(url, init);
    };
    const final = await createChatStreamClient({ transport: counting }).send(QUESTION, { token: TOKEN });

    expect(final).toMatchObject({ phase: 'error', error: { code: 'STREAM_INTERRUPTED' } });
    expect(final.tools).toHaveLength(3);
    expect(final.text.length).toBeGreaterThan(0);
    expect(requests).toBe(1); // no automatic reconnect (contract §3.3)
  });

  it('stops with PROTOCOL_ERROR on a malformed contract frame', async () => {
    const { final } = await sendCollecting(client('invalid-frame'));
    expect(final.error?.code).toBe('PROTOCOL_ERROR');
  });
});

describe('chat stream client — latency handling (FR-19)', () => {
  it('raises the "still processing" flag when no text arrives in time, then clears it', async () => {
    const c = client('slow', { slowStartMs: 60 }, { processingNoticeMs: 20, idleTimeoutMs: 1_000 });
    const { final, updates } = await sendCollecting(c);

    expect(updates.some((state) => state.slow)).toBe(true);
    expect(final).toMatchObject({ phase: 'done', slow: false });
  });

  it('cancels with CLIENT_TIMEOUT when nothing arrives within the idle timeout', async () => {
    const c = client('slow', { slowStartMs: 5_000 }, { processingNoticeMs: 10, idleTimeoutMs: 40 });
    const { final } = await sendCollecting(c);

    expect(final).toMatchObject({ phase: 'error', error: { code: 'CLIENT_TIMEOUT' } });
  });

  it('reports ABORTED when the user cancels', async () => {
    const controller = new AbortController();
    const c = client('slow', { slowStartMs: 5_000 }, { idleTimeoutMs: 10_000 });
    setTimeout(() => controller.abort(), 20);
    const { final } = await sendCollecting(c, { signal: controller.signal });

    expect(final.error?.code).toBe('ABORTED');
  });
});
