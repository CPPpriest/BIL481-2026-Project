import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildGateway } from '../src/server.js';
import { signMockToken } from '../src/auth/jwtVerifier.js';
import { InMemoryRateLimiterStore } from '../src/rate-limiter/slidingWindowRateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

type MockMcpHandler = (
  reqBody: { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } },
  res: http.ServerResponse,
  req: http.IncomingMessage
) => void | Promise<void>;

async function startConfigurableMcpServer() {
  let handler: MockMcpHandler = (body, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result: { content: [] } }));
  };
  let callCount = 0;

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', async () => {
      callCount += 1;
      const body = raw ? JSON.parse(raw) : {};
      await handler(body, res, req);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to bind test MCP server');
  }

  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    getCallCount: () => callCount,
    setHandler: (next: MockMcpHandler) => {
      handler = next;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('POST /api/v1/query MCP Proxy & Contract Adapter (S-01, API Contract v1.1 §3.2/§3.4)', () => {
  let fakeMcp: Awaited<ReturnType<typeof startConfigurableMcpServer>>;
  let app: ReturnType<typeof buildGateway>;

  beforeEach(async () => {
    fakeMcp = await startConfigurableMcpServer();
    app = buildGateway({
      rateLimiterStore: new InMemoryRateLimiterStore(),
      rateLimit: 100,
      mcpUrl: fakeMcp.url,
      mcpTimeoutMs: 250,
    });
  });

  afterEach(async () => {
    await app.close();
    await fakeMcp.close();
  });

  it('should normalize all 3 public tools for guests without calling LLM', async () => {
    fakeMcp.setHandler((body, res) => {
      const toolName = body.params?.name;
      const payloads: Record<string, unknown> = {
        get_cafeteria_menu: {
          date: '2026-11-23',
          available: true,
          lunch: {
            soup: 'Mercimek Çorbası',
            mainDish: 'Orman Kebabı',
            vegOption: 'Taze Fasulye',
            sideDish: 'Pilav',
            calories: 700,
          },
          dinner: null,
        },
        get_shuttle_schedule: {
          routeId: 'MAIN_RING',
          routeName: 'Ana Ring Hattı',
          nextDepartures: ['09:15', '09:30'],
          activeVehicles: 4,
          lastUpdated: '2026-11-23T09:00:00.000Z',
        },
        get_library_occupancy: {
          timestamp: '2026-11-23T09:00:00.000Z',
          isSimulated: true,
          totalCapacity: 300,
          totalOccupied: 120,
          floors: [{ floorId: 'FLOOR_1', name: 'Zemin', maxSeats: 100, occupiedSeats: 40 }],
        },
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            isError: false,
            source: 'CACHE_HIT',
            isSimulated: true,
            isStale: false,
            timestamp: '2026-11-23T09:00:00.000Z',
            durationMs: 4,
            content: [
              {
                type: 'json',
                source: 'CACHE_HIT',
                isSimulated: true,
                isStale: false,
                timestamp: '2026-11-23T09:00:00.000Z',
                durationMs: 4,
                data: payloads[toolName!],
              },
            ],
          },
        })
      );
    });

    for (const [toolName, parameters] of [
      ['get_cafeteria_menu', { date: '2026-11-23' }],
      ['get_shuttle_schedule', { route: 'MAIN_RING' }],
      ['get_library_occupancy', { floor: 'ALL' }],
    ] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/query',
        payload: { toolName, parameters },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(true);
      expect(body.toolName).toBe(toolName);
      expect(body.meta).toEqual({
        isSimulated: true,
        isStale: false,
        source: 'CACHE_HIT',
        timestamp: '2026-11-23T09:00:00.000Z',
        durationMs: 4,
      });
    }
  });

  it('should reject guest get_course_schedule with 401 before dispatching to MCP and allow empty [] array when authenticated', async () => {
    const guestRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      payload: { toolName: 'get_course_schedule', parameters: { day: 'SUNDAY' } },
    });
    expect(guestRes.statusCode).toBe(401);
    const guestBody = JSON.parse(guestRes.payload);
    expect(guestBody.ok).toBe(false);
    expect(guestBody.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(fakeMcp.getCallCount()).toBe(0);

    // Compare shape with tests/contracts/fixtures/query-unauthorized.json
    const unauthFixture = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tests/contracts/fixtures/query-unauthorized.json'), 'utf8')
    );
    expect(Object.keys(guestBody).sort()).toEqual(Object.keys(unauthFixture).sort());
    expect(guestBody.error.code).toBe(unauthFixture.error.code);

    // Authenticated empty array schedule MUST succeed (Contract §2: StudentClassEntry[])
    fakeMcp.setHandler((body, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            isError: false,
            source: 'LIVE',
            isSimulated: true,
            isStale: false,
            timestamp: '2026-11-22T09:00:00.000Z',
            content: [{ type: 'json', data: [] }],
          },
        })
      );
    });

    const token = signMockToken({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
    });
    const authRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: { authorization: `Bearer ${token}` },
      payload: { toolName: 'get_course_schedule', parameters: { day: 'SUNDAY' } },
    });
    expect(authRes.statusCode).toBe(200);
    const authBody = JSON.parse(authRes.payload);
    expect(authBody.ok).toBe(true);
    expect(authBody.data).toEqual([]);
  });

  it('should reject studentId/student_id/userId in parameters with 400 INVALID_PARAMS even with valid JWT', async () => {
    const token = signMockToken({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
    });

    for (const key of ['studentId', 'student_id', 'userId']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/query',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          toolName: 'get_course_schedule',
          parameters: { day: 'TODAY', [key]: 'victim-student' },
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_PARAMS');
    }

    expect(fakeMcp.getCallCount()).toBe(0);
  });

  it('should reject unknown tools, non-object parameters, malformed JSON, and JSON-RPC -32602 with 400 INVALID_PARAMS matching fixture', async () => {
    const invalidFixture = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tests/contracts/fixtures/query-invalid-params.json'), 'utf8')
    );

    const unknownRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      payload: { toolName: 'unknown_tool', parameters: {} },
    });
    expect(unknownRes.statusCode).toBe(400);
    const unknownBody = JSON.parse(unknownRes.payload);
    expect(Object.keys(unknownBody).sort()).toEqual(Object.keys(invalidFixture).sort());
    expect(unknownBody.error.code).toBe(invalidFixture.error.code);

    const malformedJsonRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: { 'content-type': 'application/json' },
      payload: '{bad json',
    });
    expect(malformedJsonRes.statusCode).toBe(400);
    expect(JSON.parse(malformedJsonRes.payload).error.code).toBe('INVALID_PARAMS');

    fakeMcp.setHandler((body, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32602, message: 'Invalid route value' },
        })
      );
    });

    const rpcInvalidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      payload: { toolName: 'get_shuttle_schedule', parameters: { route: 'BAD_ROUTE' } },
    });
    expect(rpcInvalidRes.statusCode).toBe(400);
    const rpcInvalidBody = JSON.parse(rpcInvalidRes.payload);
    expect(rpcInvalidBody.ok).toBe(false);
    expect(rpcInvalidBody.error.code).toBe('INVALID_PARAMS');
  });

  it('should preserve STALE metadata and original timestamp without dropping flags', async () => {
    const originalCacheTimestamp = '2026-11-23T08:15:00.000Z';
    fakeMcp.setHandler((body, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            isError: false,
            source: 'STALE',
            isSimulated: true,
            isStale: true,
            timestamp: originalCacheTimestamp,
            durationMs: 6,
            content: [
              {
                type: 'json',
                source: 'STALE',
                isSimulated: true,
                isStale: true,
                timestamp: originalCacheTimestamp,
                durationMs: 6,
                data: {
                  routeId: 'MAIN_RING',
                  routeName: 'Ana Ring Hattı',
                  nextDepartures: ['09:15'],
                  activeVehicles: 2,
                  lastUpdated: originalCacheTimestamp,
                },
              },
            ],
          },
        })
      );
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      payload: { toolName: 'get_shuttle_schedule', parameters: {} },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.meta).toEqual({
      isSimulated: true,
      isStale: true,
      source: 'STALE',
      timestamp: originalCacheTimestamp,
      durationMs: 6,
    });
  });

  it('should map upstream errors, empty {} payloads, unreachable MCP, and timeouts to 503/502/504 without leaking internals', async () => {
    // Case 1: Connector envelope with isError=true / CIRCUIT_OPEN -> 503 UPSTREAM_UNAVAILABLE
    fakeMcp.setHandler((body, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            isError: true,
            source: 'ERROR',
            code: 'CIRCUIT_OPEN',
            message: 'Circuit breaker open for cafeteria',
            content: [{ type: 'text', text: 'Circuit open' }],
          },
        })
      );
    });
    const unavailableRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      payload: { toolName: 'get_cafeteria_menu', parameters: {} },
    });
    expect(unavailableRes.statusCode).toBe(503);
    expect(JSON.parse(unavailableRes.payload).error.code).toBe('UPSTREAM_UNAVAILABLE');

    // Case 2: Empty {} plain object MUST NOT pass as ok:true (Contract §3.2) -> 502 DOWNSTREAM_ERROR
    fakeMcp.setHandler((body, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            isError: false,
            content: [{ type: 'json', data: {} }],
          },
        })
      );
    });
    const emptyDataRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      payload: { toolName: 'get_cafeteria_menu', parameters: {} },
    });
    expect(emptyDataRes.statusCode).toBe(502);
    expect(JSON.parse(emptyDataRes.payload).error.code).toBe('DOWNSTREAM_ERROR');

    // Case 3: Slow MCP exceeding timeout -> 504 UPSTREAM_TIMEOUT
    fakeMcp.setHandler(async (body, res) => {
      await new Promise((r) => setTimeout(r, 400));
      if (!res.writableEnded) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [] } }));
      }
    });
    const timeoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      payload: { toolName: 'get_cafeteria_menu', parameters: {} },
    });
    expect(timeoutRes.statusCode).toBe(504);
    expect(JSON.parse(timeoutRes.payload).error.code).toBe('UPSTREAM_TIMEOUT');

    // Case 4: Unreachable MCP server -> 502 DOWNSTREAM_ERROR without internal host/port leak
    const deadPortApp = buildGateway({
      rateLimiterStore: new InMemoryRateLimiterStore(),
      mcpUrl: 'http://127.0.0.1:1/mcp',
    });
    try {
      const deadRes = await deadPortApp.inject({
        method: 'POST',
        url: '/api/v1/query',
        payload: { toolName: 'get_cafeteria_menu', parameters: {} },
      });
      expect(deadRes.statusCode).toBe(502);
      const deadBody = JSON.parse(deadRes.payload);
      expect(deadBody.error.code).toBe('DOWNSTREAM_ERROR');
      expect(deadRes.payload).not.toContain('127.0.0.1:1');
    } finally {
      await deadPortApp.close();
    }
  });
});
