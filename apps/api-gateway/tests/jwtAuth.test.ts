import { describe, it, expect, beforeEach } from 'vitest';
import { buildGateway } from '../src/server.js';
import { signMockToken } from '../src/auth/jwtVerifier.js';
import { InMemoryRateLimiterStore } from '../src/rate-limiter/slidingWindowRateLimiter.js';

describe('Fastify API Gateway Perimeter Security & Auth (FR-07, FR-08, TC-07)', () => {
  let rateLimiterStore: InMemoryRateLimiterStore;
  let app: ReturnType<typeof buildGateway>;

  beforeEach(() => {
    rateLimiterStore = new InMemoryRateLimiterStore();
    app = buildGateway({ rateLimiterStore, rateLimit: 5, rateLimitWindow: 60 });
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

  it('TC-07.2: should issue signed mock JWT via mock-login endpoint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mock-login',
      payload: {
        studentId: '241101066',
        name: 'Ahmet Sefa Efendioğlu',
        email: 'ahmetsefaefendi@gmail.com',
        role: 'STUDENT',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user.studentId).toBe('241101066');
  });

  it('TC-07.3: should authenticate valid JWT, terminate raw token, and inject verified headers (FR-07)', async () => {
    const token = signMockToken({
      studentId: '241101066',
      name: 'Ahmet Sefa Efendioğlu',
      email: 'ahmetsefaefendi@gmail.com',
      role: 'STUDENT',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        toolName: 'get_course_schedule',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    // Verify 100% Perimeter Token Termination: downstream context MUST NOT contain raw token
    expect(body.downstreamContext.rawAuthorizationPresent).toBe(false);

    // Verify verified identity injection derived strictly from token claims
    expect(body.downstreamContext.injectedStudentId).toBe('241101066');
    expect(body.downstreamContext.injectedRole).toBe('STUDENT');
  });

  it('TC-07.4: should reject expired JWT with HTTP 401 Unauthorized', async () => {
    // Generate token that expired 10 seconds ago
    const expiredToken = signMockToken(
      {
        studentId: '241101066',
        name: 'Ahmet Sefa Efendioğlu',
        email: 'ahmetsefaefendi@gmail.com',
      },
      -10
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
      payload: {
        toolName: 'get_course_schedule',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('expired');
  });

  it('TC-07.5: should reject tampered signature JWT with HTTP 401 Unauthorized', async () => {
    const validToken = signMockToken({
      studentId: '241101066',
      name: 'Ahmet Sefa Efendioğlu',
      email: 'ahmetsefaefendi@gmail.com',
    });

    // Tamper with the token signature segment
    const tamperedToken = `${validToken.substring(0, validToken.length - 6)}tamper`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: {
        authorization: `Bearer ${tamperedToken}`,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('signature');
  });

  it('TC-07.6: should strip spoofed client headers to prevent privilege escalation', async () => {
    // Client attempts to spoof internal header without valid token
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: {
        'x-authenticated-student-id': '999999999',
        'x-authenticated-user-role': 'ADMIN',
      },
      payload: {
        toolName: 'get_cafeteria_menu',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // Spoofed headers must be wiped; guest defaults must be assigned
    expect(body.downstreamContext.injectedStudentId).toBeNull();
    expect(body.downstreamContext.injectedRole).toBe('GUEST');
  });

  it('TC-08 (Rate Limiting): should enforce per-identity rate limit ceiling and return HTTP 429 (FR-08)', async () => {
    const token = signMockToken({
      studentId: '241101066',
      name: 'Ahmet Sefa Efendioğlu',
      email: 'ahmetsefaefendi@gmail.com',
    });

    // Limit configured to 5 requests in beforeEach
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/query',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    }

    // 6th request within window must be throttled
    const throttledRes = await app.inject({
      method: 'POST',
      url: '/api/v1/query',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(throttledRes.statusCode).toBe(429);
    expect(throttledRes.headers['retry-after']).toBeDefined();
    const body = JSON.parse(throttledRes.payload);
    expect(body.error).toBe('Too Many Requests');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });
});

