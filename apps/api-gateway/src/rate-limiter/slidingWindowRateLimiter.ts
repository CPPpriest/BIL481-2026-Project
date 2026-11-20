import type { FastifyRequest, FastifyReply } from 'fastify';
import { sendGatewayError } from '../http/errorResponse.js';
import type { AuthenticatedRequestContext } from '../types/auth.js';

export interface RateLimiterStore {
  isRateLimited(key: string, limit: number, windowSeconds: number): Promise<{ limited: boolean; retryAfter: number }>;
}

/**
 * In-Memory Sliding-Window Rate Limiter Store
 * Tracks timestamps per key for air-gapped CI and local standalone testing
 */
export class InMemoryRateLimiterStore implements RateLimiterStore {
  private windows: Map<string, number[]> = new Map();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async isRateLimited(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ limited: boolean; retryAfter: number }> {
    const now = this.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    const timestamps = this.windows.get(key) || [];
    // Discard timestamps older than the sliding window
    const active = timestamps.filter((t) => t > cutoff);

    if (active.length >= limit) {
      const oldestActive = active[0]!;
      const retryAfter = Math.ceil((oldestActive + windowMs - now) / 1000);
      this.windows.set(key, active);
      return { limited: true, retryAfter: Math.max(1, retryAfter) };
    }

    active.push(now);
    this.windows.set(key, active);
    return { limited: false, retryAfter: 0 };
  }

  reset(): void {
    this.windows.clear();
  }
}

export const defaultRateLimiterStore = new InMemoryRateLimiterStore();

/**
 * Rate Limiting Middleware (FR-08)
 * 30 requests per 60-second sliding window per student ID (or per IP for guests)
 * Skips /health so orchestration liveness checks do not consume user quota.
 */
export function createRateLimiterMiddleware(
  limit: number = 30,
  windowSeconds: number = 60,
  store: RateLimiterStore = defaultRateLimiterStore
) {
  return async function rateLimiter(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const pathname = (request.url || '').split('?')[0];
    if (pathname === '/health') {
      return;
    }

    const context: AuthenticatedRequestContext = request.authContext || {
      studentId: null,
      role: 'GUEST',
      isAuthenticated: false,
      verifiedAt: new Date().toISOString(),
      clientIp: request.ip || '127.0.0.1',
    };

    // Partition key by student identity or guest IP
    const key =
      context.isAuthenticated && context.studentId
        ? `rate:student:${context.studentId}`
        : `rate:ip:${context.clientIp}`;

    const result = await store.isRateLimited(key, limit, windowSeconds);

    if (result.limited) {
      sendGatewayError(
        reply,
        429,
        'RATE_LIMITED',
        `Rate limit exceeded (${limit} requests per ${windowSeconds}s). Retry after ${result.retryAfter}s.`,
        { 'Retry-After': result.retryAfter.toString() }
      );
    }
  };
}
