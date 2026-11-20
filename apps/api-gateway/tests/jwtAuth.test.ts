import http from 'node:http';
import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildGateway } from '../src/server.js';
import { getJwtSecret, getMockIssuer, signMockToken } from '../src/auth/jwtVerifier.js';
import { InMemoryRateLimiterStore } from '../src/rate-limiter/slidingWindowRateLimiter.js';

interface RecordedMcpCall {
  headers: http.IncomingHttpHeaders;
  body: Record<string, unknown>;
}

async function startFakeMcpServer(): Promise<{
  url: string;
  calls: RecordedMcpCall[];
  close: () => Promise<void>;
}> {
  const calls: RecordedMcpCall[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      calls.push({ headers: req.headers, body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id ?? 1,
          result: {
            isError: false,
            source: 'LIVE',
            isSimulated: true,
            isStale: false,
            timestamp: '2026-11-23T10:00:00.000Z',
            durationMs: 5,
            content: [
              {
                type: 'json',
                source: 'LIVE',
                isSimulated: true,
                isStale: false,
                timestamp: '2026-11-23T10:00:00.000Z',
                data: [
                  {
                    courseCode: 'BIL481',
                    courseTitle: 'Yazılım Mühendisliği',
                    instructor: 'Örnek Öğretim Üyesi',
                    classroom: 'TM-213',
                    startTime: '10:30',
                    endTime: '12:20',
                  },
                ],
              },
            ],
          },
        })
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind fake MCP server');
  }

  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function makeAlgNoneJwt(studentId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: studentId,
      name: 'Attacker',
      email: 'attacker@example.test',
      role: 'ADMIN',
      iat: now,
      exp: now + 3600,
      iss: getMockIssuer(),
    })
  ).toString('base64url');
  return `${header}.${payload}.`;
}

describe('Fastify API Gateway Perimeter Security & Auth (FR-07, FR-08, TC-07)', () => {
  let rateLimiterStore: InMemoryRateLimiterStore;
  let fakeMcp: Awaited<ReturnType<typeof startFakeMcpServer>>;
  let app: ReturnType<typeof buildGateway>;

  beforeEach(async () => {
    rateLimiterStore = new InMemoryRateLimiterStore();
    fakeMcp = await startFakeMcpServer();
    app = buildGateway({
      rateLimiterStore,
      rateLimit: 20,
      rateLimitWindow: 60,
      mcpUrl: fakeMcp.url,
    });
  });

  afterEach(async () => {
    await app.close();
    await fakeMcp.close();
  });

  it('TC-07.1: should allow health check without authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('UP');
    expect(body.service).toBe('api-gateway');
  });

  it('TC-07.2: should issue signed mock JWT via mock-login and reject invalid payloads with Contract §3.4 400', async () => {
    const validRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mock-login',
      payload: {
        studentId: 'demo-student-01',
        name: 'Demo Student',
        email: 'demo@example.test',
        role: 'STUDENT',
      },
    });

    expect(validRes.statusCode).toBe(200);
    const body = JSON.parse(validRes.payload);
    expect(typeof body.token).toBe('string');
    expect(body.user).toEqual({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
      role: 'STUDENT',
    });
    expect(body.expiresIn).toBe(3600);

    const badRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mock-login',
      payload: { studentId: 'demo-student-01' },
    });
    expect(badRes.statusCode).toBe(400);
    const badBody = JSON.parse(badRes.payload);
    expect(badBody.ok).toBe(false);
    expect(badBody.error.code).toBe('INVALID_PARAMS');
  });

  it('should enforce auth on GET /api/v1/auth/me', async () => {
    const guestRes = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(guestRes.statusCode).toBe(401);
    const guestBody = JSON.parse(guestRes.payload);
    expect(guestBody.ok).toBe(false);
    expect(guestBody.error.code).toBe('AUTHENTICATION_REQUIRED');

    const token = signMockToken({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
    });
    const authRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(authRes.statusCode).toBe(200);
    const authBody = JSON.parse(authRes.payload);
    expect(authBody.authenticated).toBe(true);
    expect(authBody.context.studentId).toBe('demo-student-01');
  });

  it('TC-07.3: should terminate raw JWT at gateway and forward only verified X-Authenticated-* headers to MCP (FR-07)', async () => {
    const token = signMockToken({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
      role: 'STUDENT',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: {
        authorization: `Bearer ${token}`,
        'x-authenticated-student-id': 'spoofed-id',
        'x-authenticated-user-role': 'ADMIN',
      },
      payload: {
        toolName: 'get_course_schedule',
        parameters: { day: 'TODAY' },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.ok).toBe(true);
    expect(body.toolName).toBe('get_course_schedule');

    expect(fakeMcp.calls).toHaveLength(1);
    const forwardedHeaders = fakeMcp.calls[0]!.headers;
    expect(forwardedHeaders.authorization).toBeUndefined();
    expect(forwardedHeaders['x-authenticated-student-id']).toBe('demo-student-01');
    expect(forwardedHeaders['x-authenticated-user-role']).toBe('STUDENT');
  });

  it('TC-07.4: should reject expired JWT with Contract §3.4 HTTP 401', async () => {
    const expiredToken = signMockToken(
      {
        studentId: 'demo-student-01',
        name: 'Demo Student',
        email: 'demo@example.test',
      },
      -10
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: { authorization: `Bearer ${expiredToken}` },
      payload: { toolName: 'get_course_schedule' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(body.error.message.toLowerCase()).toContain('expired');
    expect(res.payload).not.toContain(expiredToken);
    expect(fakeMcp.calls).toHaveLength(0);
  });

  it('TC-07.5: should reject tampered signature, alg=none, untrusted issuer, and non-Bearer schemes with HTTP 401', async () => {
    const validToken = signMockToken({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
    });
    const tamperedToken = `${validToken.slice(0, -6)}tamper`;
    const wrongIssuerToken = signMockToken(
      {
        studentId: 'demo-student-01',
        name: 'Demo Student',
        email: 'demo@example.test',
      },
      3600,
      getJwtSecret(),
      'https://evil-issuer.example'
    );
    const algNoneToken = makeAlgNoneJwt('999999999');

    for (const headerValue of [
      `Bearer ${tamperedToken}`,
      `Bearer ${wrongIssuerToken}`,
      `Bearer ${algNoneToken}`,
      'Basic dXNlcjpwYXNz',
      'Bearer ',
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/query',
        headers: { authorization: headerValue },
        payload: { toolName: 'get_cafeteria_menu', parameters: {} },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    }

    expect(fakeMcp.calls).toHaveLength(0);
  });

  it('TC-07.6: should strip spoofed X-Authenticated-* headers on guest calls', async () => {
    const guestCourseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: {
        'x-authenticated-student-id': '999999999',
        'x-authenticated-user-role': 'ADMIN',
      },
      payload: { toolName: 'get_course_schedule', parameters: {} },
    });

    expect(guestCourseRes.statusCode).toBe(401);
    expect(fakeMcp.calls).toHaveLength(0);

    const publicRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: {
        'x-authenticated-student-id': '999999999',
        'x-authenticated-user-role': 'ADMIN',
      },
      payload: { toolName: 'get_cafeteria_menu', parameters: {} },
    });

    expect(publicRes.statusCode).toBe(200);
    expect(fakeMcp.calls).toHaveLength(1);
    expect(fakeMcp.calls[0]!.headers['x-authenticated-student-id']).toBeUndefined();
    expect(fakeMcp.calls[0]!.headers['x-authenticated-user-role']).toBeUndefined();
  });

  it('should require explicit JWT_SECRET when NODE_ENV=production', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);

      const runtimeSecret = crypto.randomBytes(16).toString('hex');
      process.env.JWT_SECRET = runtimeSecret;
      expect(getJwtSecret()).toBe(runtimeSecret);
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;

      if (prevSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevSecret;
    }
  });
});
