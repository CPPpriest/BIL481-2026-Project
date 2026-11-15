import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from './jwtVerifier.js';
import type { AuthenticatedRequestContext } from '../types/auth.js';

// Extend FastifyRequest type to carry our authenticated context
declare module 'fastify' {
  interface FastifyRequest {
    authContext: AuthenticatedRequestContext;
  }
}

/**
 * Perimeter Authentication & Token Termination Middleware (FR-07)
 *
 * Rules:
 * 1. Discard any client-supplied X-Authenticated-* headers to prevent identity spoofing.
 * 2. If Authorization header is present, verify Bearer JWT.
 * 3. If token is invalid or expired, reject with 401 Unauthorized.
 * 4. Terminate token: strip raw Authorization header from internal forwarding.
 * 5. Inject verified identity context into request.
 */
export async function authenticateAndTerminateToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const clientIp = request.ip || '127.0.0.1';

  // Anti-spoofing: Delete any client-injected internal auth headers
  const headers = request.headers as Record<string, string | string[] | undefined>;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase().startsWith('x-authenticated-')) {
      delete headers[key];
    }
  }

  const authHeader = request.headers.authorization;

  // Unauthenticated Guest Path
  if (!authHeader) {
    request.authContext = {
      studentId: null,
      role: 'GUEST',
      isAuthenticated: false,
      verifiedAt: new Date().toISOString(),
      clientIp,
    };
    return;
  }

  // Check Bearer scheme
  if (!authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid authorization format. Bearer scheme required.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const verification = verifyToken(token);

  if (!verification.valid || !verification.payload) {
    reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: verification.error || 'Token verification failed',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Token termination: Delete raw bearer token so downstream services never see it (FR-07)
  delete request.headers.authorization;

  // Bind verified internal identity context
  const { sub, role } = verification.payload;
  request.authContext = {
    studentId: sub,
    role,
    isAuthenticated: true,
    verifiedAt: new Date().toISOString(),
    clientIp,
  };

  // Inject verified internal headers for downstream proxying
  headers['x-authenticated-student-id'] = sub;
  headers['x-authenticated-user-role'] = role;
}

