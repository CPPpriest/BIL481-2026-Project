import fastify, { type FastifyInstance } from 'fastify';
import { authenticateAndTerminateToken } from './auth/tokenTermination.js';
import { signMockToken } from './auth/jwtVerifier.js';
import { sendGatewayError } from './http/errorResponse.js';
import { handleChatStream } from './proxy/chatStreamProxy.js';
import { forwardToolQuery } from './proxy/mcpProxy.js';
import {
  createRateLimiterMiddleware,
  defaultRateLimiterStore,
  type RateLimiterStore,
} from './rate-limiter/slidingWindowRateLimiter.js';
import type { UserRole } from './types/auth.js';

export interface BuildGatewayOptions {
  rateLimiterStore?: RateLimiterStore;
  rateLimit?: number;
  rateLimitWindow?: number;
  mcpUrl?: string;
  agentStreamUrl?: string;
  mcpTimeoutMs?: number;
  chatTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const VALID_LOGIN_ROLES: readonly UserRole[] = ['STUDENT', 'FACULTY', 'GUEST', 'ADMIN'];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Builds and configures the Fastify API Gateway Server (FR-07, FR-08, API Contract v1.1)
 */
export function buildGateway(options: BuildGatewayOptions = {}): FastifyInstance {
  const app = fastify({
    logger: false,
  });

  const rateLimitStore = options.rateLimiterStore || defaultRateLimiterStore;
  const rateLimit = options.rateLimit ?? 30;
  const rateLimitWindow = options.rateLimitWindow ?? 60;
  const mcpUrl = options.mcpUrl || process.env.MCP_URL || 'http://localhost:3001/mcp';
  const agentStreamUrl =
    options.agentStreamUrl ||
    process.env.AGENT_STREAM_URL ||
    'http://localhost:3001/internal/agent/stream';
  const mcpTimeoutMs = options.mcpTimeoutMs ?? 10_000;
  const chatTimeoutMs = options.chatTimeoutMs ?? 20_000;
  const fetchImpl = options.fetchImpl ?? fetch;

  app.setErrorHandler((err, _request, reply) => {
    const statusCode = (err as { statusCode?: unknown }).statusCode;
    const code = (err as { code?: unknown }).code;
    if (
      statusCode === 400 ||
      err instanceof SyntaxError ||
      (typeof code === 'string' && code.startsWith('FST_ERR_CTP_'))
    ) {
      return sendGatewayError(
        reply,
        400,
        'INVALID_PARAMS',
        'Malformed JSON request body or invalid parameters.'
      );
    }
    return sendGatewayError(reply, 500, 'INTERNAL_ERROR', 'Internal gateway error.');
  });

  // Global preHandler: Perimeter Token Termination and Authentication (FR-07)
  app.addHook('preHandler', authenticateAndTerminateToken);

  // Global preHandler: Tiered Rate Limiting (FR-08)
  app.addHook(
    'preHandler',
    createRateLimiterMiddleware(rateLimit, rateLimitWindow, rateLimitStore)
  );

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'UP',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  });

  // Mock SSO Login endpoint: generates signed test JWTs for synthetic personas (Contract §3.1)
  app.post('/api/v1/auth/mock-login', async (request, reply) => {
    if (!isPlainRecord(request.body)) {
      return sendGatewayError(
        reply,
        400,
        'INVALID_PARAMS',
        'studentId, name, and email are required for mock SSO login.'
      );
    }

    const { studentId, name, email, role } = request.body;
    if (
      typeof studentId !== 'string' ||
      studentId.trim().length === 0 ||
      typeof name !== 'string' ||
      name.trim().length === 0 ||
      typeof email !== 'string' ||
      email.trim().length === 0
    ) {
      return sendGatewayError(
        reply,
        400,
        'INVALID_PARAMS',
        'studentId, name, and email are required for mock SSO login.'
      );
    }

    if (role !== undefined && (typeof role !== 'string' || !VALID_LOGIN_ROLES.includes(role as UserRole))) {
      return sendGatewayError(reply, 400, 'INVALID_PARAMS', 'Invalid user role specified.');
    }

    const resolvedRole: UserRole = (role as UserRole | undefined) || 'STUDENT';
    const cleanClaims = {
      studentId: studentId.trim(),
      name: name.trim(),
      email: email.trim(),
      role: resolvedRole,
    };

    const token = signMockToken(cleanClaims);
    return {
      token,
      user: cleanClaims,
      expiresIn: 3600,
    };
  });

  // User Profile endpoint (Contract §3.1)
  app.get('/api/v1/auth/me', async (request, reply) => {
    if (!request.authContext.isAuthenticated) {
      return sendGatewayError(
        reply,
        401,
        'AUTHENTICATION_REQUIRED',
        'Authentication required to access student profile.'
      );
    }

    return {
      authenticated: true,
      context: request.authContext,
    };
  });

  // Direct Tool Query Proxy endpoint: forwards validated JSON-RPC calls to internal MCP (Contract §3.2)
  app.post('/api/v1/query', async (request, reply) => {
    if (!isPlainRecord(request.body)) {
      return sendGatewayError(reply, 400, 'INVALID_PARAMS', 'Request body must be a JSON object.');
    }

    const result = await forwardToolQuery({
      toolName: request.body.toolName,
      parameters: request.body.parameters,
      authContext: request.authContext,
      mcpUrl,
      timeoutMs: mcpTimeoutMs,
      fetchImpl,
    });

    if (result.ok) {
      return reply.status(200).send(result.body);
    }

    return reply.status(result.statusCode).send(result.body);
  });

  // Compound Agent Chat SSE Stream Proxy endpoint (Contract §3.3)
  app.post('/api/v1/chat/stream', async (request, reply) => {
    await handleChatStream(request, reply, {
      agentStreamUrl,
      timeoutMs: chatTimeoutMs,
      fetchImpl,
    });
  });

  return app;
}
