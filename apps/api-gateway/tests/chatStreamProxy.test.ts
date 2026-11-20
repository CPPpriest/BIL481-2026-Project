import http from 'node:http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildGateway } from '../src/server.js';
import { signMockToken } from '../src/auth/jwtVerifier.js';
import { InMemoryRateLimiterStore } from '../src/rate-limiter/slidingWindowRateLimiter.js';

type AgentHandler = (req: http.IncomingMessage, res: http.ServerResponse, body: Record<string, unknown>) => void | Promise<void>;

async function startFakeAgentServer() {
  let handler: AgentHandler = (_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.write('event: tool\ndata: {"toolName":"get_course_schedule","status":"LIVE","durationMs":12}\n\n');
    res.write('event: token\ndata: {"text":"Merhaba "}\n\n');
    res.write('event: token\ndata: {"text":"öğrenci."}\n\n');
    res.write('event: done\ndata: {"answer":"Merhaba öğrenci.","toolsInvoked":["get_course_schedule"],"isComplete":true}\n\n');
    res.end();
  };

  const recorded: Array<{ headers: http.IncomingHttpHeaders; body: Record<string, unknown> }> = [];

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', async () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      recorded.push({ headers: req.headers, body });
      await handler(req, res, body);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to start fake agent server');
  }

  return {
    url: `http://127.0.0.1:${addr.port}/internal/agent/stream`,
    recorded,
    setHandler: (next: AgentHandler) => {
      handler = next;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('POST /api/v1/chat/stream SSE Proxy (S-03, API Contract v1.1 §3.3)', () => {
  let fakeAgent: Awaited<ReturnType<typeof startFakeAgentServer>>;
  let app: ReturnType<typeof buildGateway>;
  let gatewayBaseUrl: string;

  beforeEach(async () => {
    fakeAgent = await startFakeAgentServer();
    app = buildGateway({
      rateLimiterStore: new InMemoryRateLimiterStore(),
      rateLimit: 100,
      agentStreamUrl: fakeAgent.url,
      chatTimeoutMs: 400,
    });
    gatewayBaseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterEach(async () => {
    await app.close();
    await fakeAgent.close();
  });

  it('should reject guest and invalid JWT with 401 AUTHENTICATION_REQUIRED before opening stream', async () => {
    const guestRes = await fetch(`${gatewayBaseUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '10:30 dersimden sonra ringe yetişir miyim?' }),
    });
    expect(guestRes.status).toBe(401);
    const guestBody = await guestRes.json();
    expect(guestBody.ok).toBe(false);
    expect(guestBody.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(fakeAgent.recorded).toHaveLength(0);
  });

  it('should reject empty, oversized (>1000), or studentId-injected chat bodies with 400 INVALID_PARAMS', async () => {
    const token = signMockToken({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
    });

    for (const payload of [
      { message: '   ' },
      { message: 'a'.repeat(1001) },
      { message: 'Merhaba', studentId: 'other-student' },
    ]) {
      const res = await fetch(`${gatewayBaseUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_PARAMS');
    }

    expect(fakeAgent.recorded).toHaveLength(0);
  });

  it('should stream Contract §3.3 SSE frames over real HTTP and strip raw Authorization + spoofed headers', async () => {
    const token = signMockToken({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
      role: 'STUDENT',
    });

    const res = await fetch(`${gatewayBaseUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
        'X-Authenticated-Student-Id': '999999999',
        'X-Authenticated-User-Role': 'ADMIN',
      },
      body: JSON.stringify({ message: '10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-cache');

    const text = await res.text();
    expect(text).toContain('event: tool');
    expect(text).toContain('event: token');
    expect(text).toContain('event: done');
    expect(text).toContain('"isComplete":true');

    expect(fakeAgent.recorded).toHaveLength(1);
    const forwarded = fakeAgent.recorded[0]!;
    expect(forwarded.headers.authorization).toBeUndefined();
    expect(forwarded.headers['x-authenticated-student-id']).toBe('demo-student-01');
    expect(forwarded.headers['x-authenticated-user-role']).toBe('STUDENT');
    expect(forwarded.body).toEqual({
      message: '10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?',
    });
  });

  it('should map pre-stream upstream failures (503, 429, 504, 502) to Contract §3.4 JSON', async () => {
    const token = signMockToken({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
    });

    // 503 -> UPSTREAM_UNAVAILABLE
    fakeAgent.setHandler((_req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'down' }));
    });
    const res503 = await fetch(`${gatewayBaseUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: 'Test 503' }),
    });
    expect(res503.status).toBe(503);
    expect((await res503.json()).error.code).toBe('UPSTREAM_UNAVAILABLE');

    // 429 -> RATE_LIMITED + Retry-After
    fakeAgent.setHandler((_req, res) => {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '15' });
      res.end(JSON.stringify({ error: 'busy' }));
    });
    const res429 = await fetch(`${gatewayBaseUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: 'Test 429' }),
    });
    expect(res429.status).toBe(429);
    expect(res429.headers.get('retry-after')).toBe('15');
    expect((await res429.json()).error.code).toBe('RATE_LIMITED');

    // Slow upstream before headers -> 504 UPSTREAM_TIMEOUT
    fakeAgent.setHandler(async (_req, res) => {
      await new Promise((r) => setTimeout(r, 600));
      if (!res.writableEnded) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end();
      }
    });
    const res504 = await fetch(`${gatewayBaseUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: 'Test 504' }),
    });
    expect(res504.status).toBe(504);
    expect((await res504.json()).error.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('should emit safe SSE error frame without leaking PII/tokens when stream fails after headers', async () => {
    const token = signMockToken({
      studentId: 'secret-student-241101066',
      name: 'Secret Name',
      email: 'secret@example.test',
    });

    fakeAgent.setHandler((_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.write('event: token\ndata: {"text":"Başlangıç "}\n\n');
      setTimeout(() => {
        res.socket?.destroy(new Error('Simulated mid-stream crash'));
      }, 30);
    });

    const res = await fetch(`${gatewayBaseUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'Test mid-stream interruption' }),
    });

    expect(res.status).toBe(200);
    const bodyText = await res.text();
    expect(bodyText).toContain('event: token');
    expect(bodyText).toContain('event: error');
    expect(bodyText).toContain('"code":"AGENT_ERROR"');
    expect(bodyText).not.toContain(token);
    expect(bodyText).not.toContain('secret-student-241101066');
    expect(bodyText).not.toContain('Simulated mid-stream crash');
  });
});
