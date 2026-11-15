import fastify, { FastifyInstance } from 'fastify';
import { authenticateAndTerminateToken } from './auth/tokenTermination.js';
import { signMockToken } from './auth/jwtVerifier.js';
import { createRateLimiterMiddleware, RateLimiterStore, defaultRateLimiterStore } from './rate-limiter/slidingWindowRateLimiter.js';
import type { UserRole } from './types/auth.js';

export interface BuildGatewayOptions {
  rateLimiterStore?: RateLimiterStore;
  rateLimit?: number;
  rateLimitWindow?: number;
}

/**
 * Builds and configures the Fastify API Gateway Server (FR-07, FR-08)
 */
export function buildGateway(options: BuildGatewayOptions = {}): FastifyInstance {
  const app = fastify({
    logger: false,
  });

  const rateLimitStore = options.rateLimiterStore || defaultRateLimiterStore;
  const rateLimit = options.rateLimit ?? 30;
  const rateLimitWindow = options.rateLimitWindow ?? 60;

  // Global preHandler: Perimeter Token Termination and Authentication (FR-07)
  app.addHook('preHandler', authenticateAndTerminateToken);

  // Global preHandler: Tiered Rate Limiting (FR-08)
  app.addHook('preHandler', createRateLimiterMiddleware(rateLimit, rateLimitWindow, rateLimitStore));

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'UP',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  });

  // Mock SSO Login endpoint: generates signed test JWTs for personas
  app.post<{
    Body: {
      studentId: string;
      name: string;
      email: string;
      role?: UserRole;
    };
  }>('/api/v1/auth/mock-login', async (request, reply) => {
    const { studentId, name, email, role } = request.body || {};
    if (!studentId || !name || !email) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'studentId, name, and email are required for mock SSO login',
      });
    }

    const token = signMockToken({ studentId, name, email, role: role || 'STUDENT' });
    return {
      token,
      user: {
        studentId,
        name,
        email,
        role: role || 'STUDENT',
      },
      expiresIn: 3600,
    };
  });

  // User Profile endpoint
  app.get('/api/v1/auth/me', async (request, reply) => {
    if (!request.authContext.isAuthenticated) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required to access student profile',
      });
    }

    return {
      authenticated: true,
      context: request.authContext,
    };
  });

  // Mock Query Proxy endpoint: demonstrates token termination & sanitized header forwarding (FR-07)
  app.post<{
    Body: {
      toolName?: string;
      parameters?: Record<string, unknown>;
    };
  }>('/api/v1/query', async (request, reply) => {
    // If requesting personal course schedule without authentication, halt (FR-06, FR-07)
    if (request.body?.toolName === 'get_course_schedule' && !request.authContext.isAuthenticated) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required for personal course schedule lookup',
      });
    }

    // Inspect headers passed downstream to verify complete absence of raw bearer token (FR-07)
    const rawAuthHeader = request.headers.authorization;
    const injectedStudentId = request.headers['x-authenticated-student-id'];
    const injectedRole = request.headers['x-authenticated-user-role'];

    return {
      success: true,
      downstreamContext: {
        rawAuthorizationPresent: Boolean(rawAuthHeader),
        injectedStudentId: injectedStudentId || null,
        injectedRole: injectedRole || 'GUEST',
        clientIp: request.authContext.clientIp,
      },
      message: 'Request passed gateway perimeter security checks',
    };
  });

  return app;
}

