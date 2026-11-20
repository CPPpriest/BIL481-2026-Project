import http from 'node:http';
import net from 'node:net';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildGateway } from '../src/server.js';
import { signMockToken } from '../src/auth/jwtVerifier.js';
import { InMemoryRateLimiterStore } from '../src/rate-limiter/slidingWindowRateLimiter.js';
import {
  createRateLimiterStoreFromEnv,
  RedisRateLimiterStore,
  RespTcpRedisClient,
  type RedisRateLimitClient,
} from '../src/rate-limiter/redisRateLimiterStore.js';

function createMockRespServer() {
  const zsets = new Map<string, Map<string, number>>();
  let authCalled = false;

  const parseCommands = (buf: Buffer): { commands: string[][]; remaining: Buffer } => {
    const commands: string[][] = [];
    let offset = 0;
    while (offset < buf.length) {
      const firstLineEnd = buf.indexOf('\r\n', offset, 'utf8');
      if (firstLineEnd === -1) break;
      if (buf[offset] !== 42) break; // '*'
      const count = Number(buf.toString('utf8', offset + 1, firstLineEnd));
      let cursor = firstLineEnd + 2;
      const args: string[] = [];
      let incomplete = false;
      for (let i = 0; i < count; i++) {
        const lenEnd = buf.indexOf('\r\n', cursor, 'utf8');
        if (lenEnd === -1) {
          incomplete = true;
          break;
        }
        const len = Number(buf.toString('utf8', cursor + 1, lenEnd));
        const dataStart = lenEnd + 2;
        const dataEnd = dataStart + len;
        if (buf.length < dataEnd + 2) {
          incomplete = true;
          break;
        }
        args.push(buf.toString('utf8', dataStart, dataEnd));
        cursor = dataEnd + 2;
      }
      if (incomplete) break;
      commands.push(args);
      offset = cursor;
    }
    return { commands, remaining: buf.subarray(offset) };
  };

  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const { commands, remaining } = parseCommands(buffer);
      buffer = remaining;

      for (const args of commands) {
        const cmd = (args[0] || '').toUpperCase();
        if (cmd === 'AUTH') {
          authCalled = true;
          socket.write('+OK\r\n');
        } else if (cmd === 'PING') {
          socket.write('+PONG\r\n');
        } else if (cmd === 'ZREMRANGEBYSCORE') {
          const key = args[1]!;
          const maxScore = Number(args[3]!);
          const set = zsets.get(key) ?? new Map<string, number>();
          let removed = 0;
          for (const [member, score] of set.entries()) {
            if (score <= maxScore) {
              set.delete(member);
              removed += 1;
            }
          }
          socket.write(`:${removed}\r\n`);
        } else if (cmd === 'ZCARD') {
          const set = zsets.get(args[1]!);
          socket.write(`:${set ? set.size : 0}\r\n`);
        } else if (cmd === 'ZADD') {
          const key = args[1]!;
          const score = Number(args[2]!);
          const member = args[3]!;
          let set = zsets.get(key);
          if (!set) {
            set = new Map<string, number>();
            zsets.set(key, set);
          }
          const added = set.has(member) ? 0 : 1;
          set.set(member, score);
          socket.write(`:${added}\r\n`);
        } else if (cmd === 'ZRANGE') {
          const set = zsets.get(args[1]!);
          if (!set || set.size === 0) {
            socket.write('*0\r\n');
          } else {
            const sorted = [...set.entries()].sort((a, b) => a[1] - b[1]);
            const [member, score] = sorted[0]!;
            const sStr = String(score);
            socket.write(
              `*2\r\n$${Buffer.byteLength(member)}\r\n${member}\r\n$${Buffer.byteLength(sStr)}\r\n${sStr}\r\n`
            );
          }
        } else if (cmd === 'PEXPIRE') {
          socket.write(':1\r\n');
        } else {
          socket.write(`-ERR unknown command ${cmd}\r\n`);
        }
      }
    });
  });

  return {
    server,
    wasAuthCalled: () => authCalled,
    start: async () => {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Mock RESP bind failed');
      return addr.port;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('Sliding-Window Rate Limiter & Redis Store (S-04, FR-08)', () => {
  let fakeMcp: http.Server;
  let mcpUrl: string;

  beforeEach(async () => {
    fakeMcp = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              isError: false,
              source: 'LIVE',
              isSimulated: true,
              isStale: false,
              timestamp: '2026-11-23T09:00:00.000Z',
              content: [{ type: 'json', data: { date: '2026-11-23', available: true, lunch: {}, dinner: null } }],
            },
          })
        );
      });
    });
    await new Promise<void>((resolve) => fakeMcp.listen(0, '127.0.0.1', resolve));
    const addr = fakeMcp.address();
    if (!addr || typeof addr === 'string') throw new Error('Fake MCP failed');
    mcpUrl = `http://127.0.0.1:${addr.port}/mcp`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => fakeMcp.close(() => resolve()));
  });

  it('should allow 30 requests per 60s and reject the 31st with HTTP 429 RATE_LIMITED + Retry-After, while isolating keys and exempting /health', async () => {
    let nowMs = 1_700_000_000_000;
    const store = new InMemoryRateLimiterStore(() => nowMs);
    const app = buildGateway({
      rateLimiterStore: store,
      rateLimit: 30,
      rateLimitWindow: 60,
      mcpUrl,
    });

    try {
      const studentA = signMockToken({
        studentId: 'student-a',
        name: 'Student A',
        email: 'a@example.test',
      });
      const studentB = signMockToken({
        studentId: 'student-b',
        name: 'Student B',
        email: 'b@example.test',
      });

      for (let i = 0; i < 30; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/query',
          headers: { authorization: `Bearer ${studentA}` },
          payload: { toolName: 'get_cafeteria_menu', parameters: {} },
        });
        expect(res.statusCode).toBe(200);
      }

      // 31st request for student A -> 429 RATE_LIMITED (Contract §3.4)
      const throttled = await app.inject({
        method: 'POST',
        url: '/api/v1/query',
        headers: { authorization: `Bearer ${studentA}` },
        payload: { toolName: 'get_cafeteria_menu', parameters: {} },
      });
      expect(throttled.statusCode).toBe(429);
      expect(Number(throttled.headers['retry-after'])).toBeGreaterThan(0);
      const throttledBody = JSON.parse(throttled.payload);
      expect(throttledBody.ok).toBe(false);
      expect(throttledBody.error.code).toBe('RATE_LIMITED');

      // Student B and /health are unaffected
      const studentBRes = await app.inject({
        method: 'POST',
        url: '/api/v1/query',
        headers: { authorization: `Bearer ${studentB}` },
        payload: { toolName: 'get_cafeteria_menu', parameters: {} },
      });
      expect(studentBRes.statusCode).toBe(200);

      const healthRes = await app.inject({ method: 'GET', url: '/health' });
      expect(healthRes.statusCode).toBe(200);

      // Advance fake clock by 61s -> window expires and student A succeeds again
      nowMs += 61_000;
      const recovered = await app.inject({
        method: 'POST',
        url: '/api/v1/query',
        headers: { authorization: `Bearer ${studentA}` },
        payload: { toolName: 'get_cafeteria_menu', parameters: {} },
      });
      expect(recovered.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('should execute sliding-window sorted set commands via mock RedisRateLimitClient', async () => {
    const ops: string[] = [];
    let count = 0;
    const mockClient: RedisRateLimitClient = {
      async zRemRangeByScore(_key, _min, _max) {
        ops.push('ZREMRANGEBYSCORE');
        return 0;
      },
      async zCard(_key) {
        ops.push('ZCARD');
        return count;
      },
      async zRangeOldestScore(_key) {
        ops.push('ZRANGE');
        return 1_700_000_000_000;
      },
      async zAdd(_key, _score, _member) {
        ops.push('ZADD');
        count += 1;
        return 1;
      },
      async pExpire(_key, _ms) {
        ops.push('PEXPIRE');
        return 1;
      },
    };

    const store = new RedisRateLimiterStore(mockClient, { now: () => 1_700_000_010_000 });
    expect(await store.isRateLimited('rate:student:1', 2, 60)).toEqual({ limited: false, retryAfter: 0 });
    expect(await store.isRateLimited('rate:student:1', 2, 60)).toEqual({ limited: false, retryAfter: 0 });
    expect(await store.isRateLimited('rate:student:1', 2, 60)).toEqual({ limited: true, retryAfter: 50 });
    expect(ops).toContain('ZREMRANGEBYSCORE');
    expect(ops).toContain('ZADD');
    expect(ops).toContain('PEXPIRE');
    expect(ops).toContain('ZRANGE');
  });

  it('should communicate with a RESP2 TCP server via RespTcpRedisClient and failOpen cleanly when unreachable', async () => {
    const respServer = createMockRespServer();
    const port = await respServer.start();

    const tcpClient = new RespTcpRedisClient(`redis://:secretpass@127.0.0.1:${port}/0`);
    try {
      expect(await tcpClient.ping()).toBe('PONG');
      expect(respServer.wasAuthCalled()).toBe(true);

      const store = new RedisRateLimiterStore(tcpClient);
      expect((await store.isRateLimited('rate:ip:127.0.0.1', 2, 60)).limited).toBe(false);
      expect((await store.isRateLimited('rate:ip:127.0.0.1', 2, 60)).limited).toBe(false);
      const third = await store.isRateLimited('rate:ip:127.0.0.1', 2, 60);
      expect(third.limited).toBe(true);
      expect(third.retryAfter).toBeGreaterThan(0);
    } finally {
      await tcpClient.close();
      await respServer.close();
    }

    // Fail-open fallback when Redis port is unreachable
    const envFactory = createRateLimiterStoreFromEnv(
      { REDIS_URL: 'redis://127.0.0.1:1' },
      { failOpen: true, timeoutMs: 150 }
    );
    try {
      expect(envFactory.kind).toBe('redis');
      const r1 = await envFactory.store.isRateLimited('rate:ip:fallback', 1, 60);
      const r2 = await envFactory.store.isRateLimited('rate:ip:fallback', 1, 60);
      expect(r1.limited).toBe(false);
      expect(r2.limited).toBe(true);
    } finally {
      await envFactory.close();
    }
  });
});
