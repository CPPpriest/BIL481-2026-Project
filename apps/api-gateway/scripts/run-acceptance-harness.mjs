#!/usr/bin/env node
/**
 * Gateway Acceptance & Contract Verification Harness (S-07).
 *
 * Modes:
 *   --mode=stub-self-test   Starts an in-process fake MCP + Agent SSE downstream and runs
 *                           the compiled Fastify gateway against it. Verifies gateway
 *                           contract, auth, error mapping, and SSE pass-through ONLY.
 *                           NEVER counts as a real E2E acceptance PASS.
 *   --mode=smoke            Targets an already-running live gateway (GATEWAY_URL, default
 *                           http://localhost:3000) to smoke-test UC-01..UC-04 and security.
 */
import http from 'node:http';
import assert from 'node:assert/strict';
import { buildGateway } from '../dist/server.js';
import { InMemoryRateLimiterStore } from '../dist/rate-limiter/slidingWindowRateLimiter.js';

function parseArgs(argv) {
  const modeArg = argv.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg ? modeArg.slice('--mode='.length) : 'stub-self-test';
  if (mode !== 'stub-self-test' && mode !== 'smoke') {
    throw new Error(`Unsupported mode "${mode}". Use --mode=stub-self-test or --mode=smoke.`);
  }
  return { mode };
}

function redactToken(token) {
  if (!token || typeof token !== 'string') return '<none>';
  return `${token.slice(0, 8)}...<redacted>`;
}

function startStubDownstream() {
  const observedRequests = [];

  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      const parsedBody = rawBody ? JSON.parse(rawBody) : {};
      observedRequests.push({
        url: req.url,
        authorizationPresent: 'authorization' in req.headers,
        studentId: req.headers['x-authenticated-student-id'] ?? null,
        role: req.headers['x-authenticated-user-role'] ?? null,
      });

      if (req.url === '/mcp' && req.method === 'POST') {
        const toolName = parsedBody?.params?.name;
        const toolArgs = parsedBody?.params?.arguments ?? {};
        res.writeHead(200, { 'Content-Type': 'application/json' });

        if (toolName === 'get_cafeteria_menu') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsedBody.id,
              result: {
                isError: false,
                source: 'LIVE',
                isSimulated: true,
                isStale: false,
                timestamp: '2026-11-23T09:00:00.000Z',
                durationMs: 7,
                content: [
                  {
                    type: 'json',
                    source: 'LIVE',
                    isSimulated: true,
                    isStale: false,
                    timestamp: '2026-11-23T09:00:00.000Z',
                    durationMs: 7,
                    data: {
                      date: toolArgs.date ?? '2026-11-23',
                      available: true,
                      lunch: {
                        soup: 'Mercimek Çorbası',
                        mainDish: 'Orman Kebabı',
                        vegOption: 'Zeytinyağlı Taze Fasulye',
                        sideDish: 'Pirinç Pilavı',
                        calories: 820,
                      },
                      dinner: {
                        soup: 'Ezogelin Çorbası',
                        mainDish: 'Tavuk Sote',
                        sideDish: 'Bulgur Pilavı',
                        calories: 770,
                      },
                    },
                  },
                ],
              },
            })
          );
          return;
        }

        if (toolName === 'get_shuttle_schedule') {
          if (toolArgs.route === 'INVALID_ROUTE') {
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                id: parsedBody.id,
                error: { code: -32602, message: 'Invalid route value' },
              })
            );
            return;
          }
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsedBody.id,
              result: {
                isError: false,
                source: 'CACHE_HIT',
                isSimulated: true,
                isStale: false,
                timestamp: '2026-11-23T09:00:00.000Z',
                durationMs: 3,
                content: [
                  {
                    type: 'json',
                    source: 'CACHE_HIT',
                    isSimulated: true,
                    isStale: false,
                    timestamp: '2026-11-23T09:00:00.000Z',
                    durationMs: 3,
                    data: {
                      routeId: toolArgs.route ?? 'MAIN_RING',
                      routeName: 'Ana Ring Hattı',
                      nextDepartures: ['09:15', '09:30', '09:45'],
                      activeVehicles: 4,
                      lastUpdated: '2026-11-23T09:00:00.000Z',
                    },
                  },
                ],
              },
            })
          );
          return;
        }

        if (toolName === 'get_library_occupancy') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsedBody.id,
              result: {
                isError: false,
                source: 'STALE',
                isSimulated: true,
                isStale: true,
                timestamp: '2026-11-23T08:45:00.000Z',
                durationMs: 4,
                content: [
                  {
                    type: 'json',
                    source: 'STALE',
                    isSimulated: true,
                    isStale: true,
                    timestamp: '2026-11-23T08:45:00.000Z',
                    durationMs: 4,
                    data: {
                      timestamp: '2026-11-23T08:45:00.000Z',
                      isSimulated: true,
                      totalCapacity: 300,
                      totalOccupied: 135,
                      floors: [
                        { floorId: 'FLOOR_1', name: 'Zemin Kat', maxSeats: 100, occupiedSeats: 45 },
                        { floorId: 'FLOOR_2', name: '1. Kat', maxSeats: 120, occupiedSeats: 52 },
                        { floorId: 'FLOOR_3', name: '2. Kat', maxSeats: 80, occupiedSeats: 38 },
                      ],
                    },
                  },
                ],
              },
            })
          );
          return;
        }

        if (toolName === 'get_course_schedule') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsedBody.id,
              result: {
                isError: false,
                source: 'LIVE',
                isSimulated: true,
                isStale: false,
                timestamp: '2026-11-23T09:00:00.000Z',
                durationMs: 9,
                content: [
                  {
                    type: 'json',
                    source: 'LIVE',
                    isSimulated: true,
                    isStale: false,
                    timestamp: '2026-11-23T09:00:00.000Z',
                    durationMs: 9,
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
          return;
        }
      }

      if (req.url === '/internal/agent/stream' && req.method === 'POST') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.write('event: tool\ndata: {"toolName":"get_course_schedule","status":"LIVE","durationMs":9}\n\n');
        res.write('event: tool\ndata: {"toolName":"get_shuttle_schedule","status":"CACHE_HIT","durationMs":3}\n\n');
        res.write('event: tool\ndata: {"toolName":"get_cafeteria_menu","status":"LIVE","durationMs":7}\n\n');
        res.write('event: token\ndata: {"text":"Stub SSE stream verified."}\n\n');
        res.write(
          'event: done\ndata: {"answer":"Stub SSE stream verified.","toolsInvoked":["get_course_schedule","get_shuttle_schedule","get_cafeteria_menu"],"isComplete":true}\n\n'
        );
        res.end();
        return;
      }

      res.writeHead(404).end();
    });
  });

  return { server, observedRequests };
}

async function runChecks(baseUrl, options) {
  const results = [];
  const record = (name, status, detail) => {
    results.push({ name, status, detail });
    console.log(`[${status}] ${name} — ${detail}`);
  };

  // 1. Health
  const healthRes = await fetch(`${baseUrl}/health`);
  assert.equal(healthRes.status, 200);
  const healthBody = await healthRes.json();
  assert.equal(healthBody.status, 'UP');
  record('GATEWAY_HEALTH', 'PASS', `HTTP 200 (${healthBody.service})`);

  // 2. Guest public UC-01..UC-03 + anti-spoofing check
  const uc01 = await fetch(`${baseUrl}/api/v1/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authenticated-Student-Id': '999999999',
      'X-Authenticated-User-Role': 'ADMIN',
    },
    body: JSON.stringify({ toolName: 'get_cafeteria_menu', parameters: { date: '2026-11-23' } }),
  });
  assert.equal(uc01.status, 200);
  const uc01Body = await uc01.json();
  assert.equal(uc01Body.ok, true);
  assert.equal(uc01Body.meta.isSimulated, true);
  record('UC-01_PUBLIC_QUERY', 'PASS', `source=${uc01Body.meta.source}, isSimulated=${uc01Body.meta.isSimulated}`);

  const uc02 = await fetch(`${baseUrl}/api/v1/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName: 'get_shuttle_schedule', parameters: { route: 'MAIN_RING' } }),
  });
  assert.equal(uc02.status, 200);
  const uc02Body = await uc02.json();
  assert.equal(uc02Body.ok, true);
  record('UC-02_PUBLIC_QUERY', 'PASS', `route=${uc02Body.data.routeId}, source=${uc02Body.meta.source}`);

  const uc02Invalid = await fetch(`${baseUrl}/api/v1/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName: 'get_shuttle_schedule', parameters: { route: 'INVALID_ROUTE' } }),
  });
  assert.equal(uc02Invalid.status, 400);
  const uc02InvalidBody = await uc02Invalid.json();
  assert.equal(uc02InvalidBody.error.code, 'INVALID_PARAMS');
  record('UC-02_INVALID_ROUTE', 'PASS', `HTTP 400 ${uc02InvalidBody.error.code}`);

  const uc03 = await fetch(`${baseUrl}/api/v1/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName: 'get_library_occupancy', parameters: { floor: 'ALL' } }),
  });
  assert.equal(uc03.status, 200);
  const uc03Body = await uc03.json();
  assert.equal(uc03Body.ok, true);
  record('UC-03_PUBLIC_QUERY', 'PASS', `source=${uc03Body.meta.source}, isStale=${uc03Body.meta.isStale}`);

  // 3. Unauthenticated private tool and chat must fail 401 BEFORE downstream
  const unauthCourse = await fetch(`${baseUrl}/api/v1/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName: 'get_course_schedule', parameters: { day: 'TODAY' } }),
  });
  assert.equal(unauthCourse.status, 401);
  const unauthCourseBody = await unauthCourse.json();
  assert.equal(unauthCourseBody.error.code, 'AUTHENTICATION_REQUIRED');
  record('SEC_GUEST_COURSE_DENIED', 'PASS', 'HTTP 401 AUTHENTICATION_REQUIRED');

  const unauthChat = await fetch(`${baseUrl}/api/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '10:30 dersimden sonra ringe yetişir miyim?' }),
  });
  assert.equal(unauthChat.status, 401);
  record('SEC_GUEST_CHAT_DENIED', 'PASS', 'HTTP 401 AUTHENTICATION_REQUIRED');

  // 4. Mock login + authenticated course schedule + injection rejection + SSE stream
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/mock-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: 'demo-student-01',
      name: 'Demo Student',
      email: 'demo@example.test',
      role: 'STUDENT',
    }),
  });
  assert.equal(loginRes.status, 200);
  const loginBody = await loginRes.json();
  assert.ok(loginBody.token);
  record('MOCK_LOGIN', 'PASS', `token=${redactToken(loginBody.token)}, studentId=${loginBody.user.studentId}`);

  const injectionRes = await fetch(`${baseUrl}/api/v1/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({
      toolName: 'get_course_schedule',
      parameters: { day: 'TODAY', studentId: 'other-student' },
    }),
  });
  assert.equal(injectionRes.status, 400);
  record('SEC_STUDENT_ID_INJECTION_BLOCKED', 'PASS', 'HTTP 400 INVALID_PARAMS');

  const authCourse = await fetch(`${baseUrl}/api/v1/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({ toolName: 'get_course_schedule', parameters: { day: 'TODAY' } }),
  });
  assert.equal(authCourse.status, 200);
  const authCourseBody = await authCourse.json();
  assert.equal(authCourseBody.ok, true);
  assert.ok(Array.isArray(authCourseBody.data));
  record('AUTH_COURSE_SCHEDULE', 'PASS', `entries=${authCourseBody.data.length}`);

  const chatRes = await fetch(`${baseUrl}/api/v1/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({ message: '10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?' }),
  });
  assert.equal(chatRes.status, 200);
  assert.match(chatRes.headers.get('content-type') ?? '', /text\/event-stream/);
  const sseText = await chatRes.text();
  assert.match(sseText, /event: tool/);
  assert.match(sseText, /event: token/);
  assert.match(sseText, /event: done/);
  record('UC-04_CHAT_SSE_STREAM', 'PASS', `received ${sseText.length} bytes of SSE frames`);

  if (options.observedRequests) {
    assert.ok(options.observedRequests.length >= 5);
    for (const req of options.observedRequests) {
      assert.equal(req.authorizationPresent, false, 'Raw Authorization header leaked downstream');
    }
    const guestCall = options.observedRequests[0];
    assert.equal(guestCall.studentId, null, 'Spoofed X-Authenticated-Student-Id leaked on guest call');
    record('SEC_TOKEN_TERMINATION', 'PASS', `0 Authorization headers across ${options.observedRequests.length} downstream calls`);
  }

  return results;
}

async function main() {
  const { mode } = parseArgs(process.argv.slice(2));
  console.log('========================================================================');
  console.log(`Gateway Verification Harness — mode=${mode}`);
  console.log(`Executed at: ${new Date().toISOString()}`);
  if (mode === 'stub-self-test') {
    console.log('NOTICE: STUB_VERIFICATION_ONLY — Uses in-process fake MCP & Agent SSE.');
    console.log('        This verifies gateway contract/auth/SSE proxy only, NOT real AT-01..AT-04.');
  }
  console.log('========================================================================');

  if (mode === 'smoke') {
    const gatewayUrl = (process.env.GATEWAY_URL || 'http://localhost:3000').replace(/\/+$/, '');
    await runChecks(gatewayUrl, {});
    return;
  }

  const { server: downstreamServer, observedRequests } = startStubDownstream();
  await new Promise((resolve) => downstreamServer.listen(0, '127.0.0.1', resolve));
  const downstreamAddr = downstreamServer.address();
  const downstreamUrl = `http://127.0.0.1:${downstreamAddr.port}`;

  const gateway = buildGateway({
    rateLimiterStore: new InMemoryRateLimiterStore(),
    rateLimit: 100,
    rateLimitWindow: 60,
    mcpUrl: `${downstreamUrl}/mcp`,
    agentStreamUrl: `${downstreamUrl}/internal/agent/stream`,
  });

  try {
    const gatewayAddress = await gateway.listen({ port: 0, host: '127.0.0.1' });
    await runChecks(gatewayAddress, { observedRequests });
    console.log('========================================================================');
    console.log('RESULT: STUB_SELF_TEST_PASSED (gateway-only; real E2E AT-01..AT-04 remain BLOCKED)');
    console.log('========================================================================');
  } finally {
    await gateway.close();
    await new Promise((resolve) => downstreamServer.close(resolve));
  }
}

main().catch((err) => {
  console.error('[HARNESS FAILED]', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
