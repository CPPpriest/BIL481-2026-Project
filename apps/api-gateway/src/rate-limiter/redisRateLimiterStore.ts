import net from 'node:net';
import { InMemoryRateLimiterStore, type RateLimiterStore } from './slidingWindowRateLimiter.js';

/**
 * Minimal sorted-set interface required for sliding-window rate limiting on Redis.
 */
export interface RedisRateLimitClient {
  zRemRangeByScore(key: string, min: string | number, max: string | number): Promise<number>;
  zCard(key: string): Promise<number>;
  zRangeOldestScore(key: string): Promise<number | null>;
  zAdd(key: string, score: number, member: string): Promise<number>;
  pExpire(key: string, milliseconds: number): Promise<number>;
  ping?(): Promise<string>;
  close?(): Promise<void>;
}

export interface RedisRateLimiterStoreOptions {
  now?: () => number;
  fallbackStore?: RateLimiterStore;
  failOpen?: boolean;
  onError?: (error: unknown) => void;
}

/**
 * Redis-backed sliding-window RateLimiterStore (FR-08).
 * Uses a Redis sorted set per key (score = request timestamp in ms).
 */
export class RedisRateLimiterStore implements RateLimiterStore {
  private readonly now: () => number;
  private readonly fallbackStore?: RateLimiterStore;
  private readonly failOpen: boolean;
  private readonly onError?: (error: unknown) => void;
  private seq = 0;

  constructor(
    private readonly client: RedisRateLimitClient,
    options: RedisRateLimiterStoreOptions = {}
  ) {
    this.now = options.now ?? (() => Date.now());
    this.fallbackStore = options.fallbackStore;
    this.failOpen = options.failOpen ?? false;
    this.onError = options.onError;
  }

  async isRateLimited(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ limited: boolean; retryAfter: number }> {
    const now = this.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    try {
      await this.client.zRemRangeByScore(key, '-inf', cutoff);
      const count = await this.client.zCard(key);

      if (count >= limit) {
        const oldestScore = await this.client.zRangeOldestScore(key);
        const retryAfter =
          oldestScore !== null
            ? Math.max(1, Math.ceil((oldestScore + windowMs - now) / 1000))
            : Math.max(1, windowSeconds);
        return { limited: true, retryAfter };
      }

      this.seq = (this.seq + 1) % 1_000_000;
      const member = `${now}-${this.seq}`;
      await this.client.zAdd(key, now, member);
      await this.client.pExpire(key, windowMs);
      return { limited: false, retryAfter: 0 };
    } catch (error) {
      this.onError?.(error);
      if (this.fallbackStore) {
        return this.fallbackStore.isRateLimited(key, limit, windowSeconds);
      }
      if (this.failOpen) {
        return { limited: false, retryAfter: 0 };
      }
      throw error;
    }
  }
}

export interface ParsedRedisUrl {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
}

export function parseRedisUrl(redisUrl: string): ParsedRedisUrl {
  const url = new URL(redisUrl);
  if (url.protocol !== 'redis:') {
    throw new Error(`Unsupported Redis protocol "${url.protocol}". Expected redis://`);
  }
  const host = url.hostname || 'localhost';
  const port = url.port ? Number(url.port) : 6379;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid Redis port "${url.port}"`);
  }
  const dbPath = url.pathname.replace(/^\//, '');
  const db = dbPath ? Number(dbPath) : 0;
  if (!Number.isInteger(db) || db < 0) {
    throw new Error(`Invalid Redis database index "${dbPath}"`);
  }
  return {
    host,
    port,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db,
  };
}

type RespValue = string | number | null | RespValue[];

interface ParseResult {
  value: RespValue;
  bytesConsumed: number;
}

function tryParseResp(buffer: Buffer, offset = 0): ParseResult | null {
  if (offset >= buffer.length) return null;

  const crlfIndex = buffer.indexOf('\r\n', offset, 'utf8');
  if (crlfIndex === -1) return null;

  const prefix = String.fromCharCode(buffer[offset]!);
  const line = buffer.toString('utf8', offset + 1, crlfIndex);
  const nextOffset = crlfIndex + 2;

  switch (prefix) {
    case '+':
      return { value: line, bytesConsumed: nextOffset - offset };
    case '-':
      throw new Error(`Redis error: ${line}`);
    case ':':
      return { value: Number(line), bytesConsumed: nextOffset - offset };
    case '$': {
      const length = Number(line);
      if (length === -1) {
        return { value: null, bytesConsumed: nextOffset - offset };
      }
      const end = nextOffset + length;
      if (buffer.length < end + 2) return null;
      const str = buffer.toString('utf8', nextOffset, end);
      return { value: str, bytesConsumed: end + 2 - offset };
    }
    case '*': {
      const count = Number(line);
      if (count === -1) {
        return { value: null, bytesConsumed: nextOffset - offset };
      }
      const items: RespValue[] = [];
      let cursor = nextOffset;
      for (let i = 0; i < count; i++) {
        const parsed = tryParseResp(buffer, cursor);
        if (!parsed) return null;
        items.push(parsed.value);
        cursor += parsed.bytesConsumed;
      }
      return { value: items, bytesConsumed: cursor - offset };
    }
    default:
      throw new Error(`Unexpected RESP prefix: ${prefix}`);
  }
}

function encodeRespCommand(args: Array<string | number>): Buffer {
  const chunks: Buffer[] = [Buffer.from(`*${args.length}\r\n`, 'utf8')];
  for (const arg of args) {
    const str = String(arg);
    const bytes = Buffer.from(str, 'utf8');
    chunks.push(Buffer.from(`$${bytes.length}\r\n`, 'utf8'), bytes, Buffer.from('\r\n', 'utf8'));
  }
  return Buffer.concat(chunks);
}

/**
 * Lightweight dependency-free RESP2 TCP client for Redis (works against real redis:7-alpine
 * and mock TCP RESP servers without adding third-party packages to root lockfiles).
 */
export class RespTcpRedisClient implements RedisRateLimitClient {
  private readonly config: ParsedRedisUrl;
  private readonly timeoutMs: number;
  private socket: net.Socket | null = null;
  private connectPromise: Promise<net.Socket> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(redisUrl: string, timeoutMs = 1500) {
    this.config = parseRedisUrl(redisUrl);
    this.timeoutMs = timeoutMs;
  }

  private async ensureSocket(): Promise<net.Socket> {
    if (this.socket && !this.socket.destroyed) {
      return this.socket;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection({ host: this.config.host, port: this.config.port });
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(new Error('Redis connection timed out'));
        }
      }, this.timeoutMs);

      socket.once('connect', async () => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        this.socket = socket;
        try {
          if (this.config.password) {
            const authArgs = this.config.username
              ? ['AUTH', this.config.username, this.config.password]
              : ['AUTH', this.config.password];
            await this.sendRawOnSocket(socket, authArgs);
          }
          if (this.config.db > 0) {
            await this.sendRawOnSocket(socket, ['SELECT', this.config.db]);
          }
          resolve(socket);
        } catch (err) {
          socket.destroy();
          this.socket = null;
          reject(err);
        }
      });

      socket.once('error', (err) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(err);
        }
        this.socket = null;
      });

      socket.once('close', () => {
        if (this.socket === socket) {
          this.socket = null;
        }
      });
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private sendRawOnSocket(socket: net.Socket, args: Array<string | number>): Promise<RespValue> {
    return new Promise((resolve, reject) => {
      let buffer = Buffer.alloc(0);
      let settled = false;

      const cleanup = () => {
        clearTimeout(timer);
        socket.off('data', onData);
        socket.off('error', onError);
        socket.off('close', onClose);
      };

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          socket.destroy();
          reject(new Error('Redis command timed out'));
        }
      }, this.timeoutMs);

      const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        try {
          const parsed = tryParseResp(buffer);
          if (parsed) {
            settled = true;
            cleanup();
            resolve(parsed.value);
          }
        } catch (err) {
          settled = true;
          cleanup();
          reject(err);
        }
      };

      const onError = (err: Error) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(err);
        }
      };

      const onClose = () => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error('Redis connection closed'));
        }
      };

      socket.on('data', onData);
      socket.once('error', onError);
      socket.once('close', onClose);
      socket.write(encodeRespCommand(args));
    });
  }

  private execute(args: Array<string | number>): Promise<RespValue> {
    const run = async () => {
      const socket = await this.ensureSocket();
      return this.sendRawOnSocket(socket, args);
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async zRemRangeByScore(key: string, min: string | number, max: string | number): Promise<number> {
    const result = await this.execute(['ZREMRANGEBYSCORE', key, min, max]);
    return Number(result ?? 0);
  }

  async zCard(key: string): Promise<number> {
    const result = await this.execute(['ZCARD', key]);
    return Number(result ?? 0);
  }

  async zRangeOldestScore(key: string): Promise<number | null> {
    const result = await this.execute(['ZRANGE', key, 0, 0, 'WITHSCORES']);
    if (!Array.isArray(result) || result.length < 2) {
      return null;
    }
    const score = Number(result[1]);
    return Number.isFinite(score) ? score : null;
  }

  async zAdd(key: string, score: number, member: string): Promise<number> {
    const result = await this.execute(['ZADD', key, score, member]);
    return Number(result ?? 0);
  }

  async pExpire(key: string, milliseconds: number): Promise<number> {
    const result = await this.execute(['PEXPIRE', key, milliseconds]);
    return Number(result ?? 0);
  }

  async ping(): Promise<string> {
    const result = await this.execute(['PING']);
    return String(result ?? '');
  }

  async close(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    if (socket && !socket.destroyed) {
      socket.end();
      socket.destroy();
    }
  }
}

export interface RateLimiterFactoryResult {
  store: RateLimiterStore;
  kind: 'redis' | 'in-memory';
  close: () => Promise<void>;
}

/**
 * Creates the production/runtime RateLimiterStore from environment variables.
 * Uses RedisRateLimiterStore when REDIS_URL is set (with safe in-memory fallback on Redis outage),
 * or InMemoryRateLimiterStore when REDIS_URL is absent.
 */
export function createRateLimiterStoreFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: { failOpen?: boolean; timeoutMs?: number } = {}
): RateLimiterFactoryResult {
  const redisUrl = env.REDIS_URL?.trim();
  const fallbackStore = new InMemoryRateLimiterStore();

  if (!redisUrl) {
    return {
      store: fallbackStore,
      kind: 'in-memory',
      close: async () => undefined,
    };
  }

  const client = new RespTcpRedisClient(redisUrl, options.timeoutMs ?? 1500);
  const store = new RedisRateLimiterStore(client, {
    fallbackStore: options.failOpen === false ? undefined : fallbackStore,
    failOpen: options.failOpen ?? true,
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Unknown Redis error';
      console.warn(`[API Gateway] Redis rate limiter error (using fallback): ${msg}`);
    },
  });

  return {
    store,
    kind: 'redis',
    close: () => client.close(),
  };
}
