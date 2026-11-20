import type { FastifyReply } from 'fastify';

/**
 * Gateway error codes defined in API Contract v1.1 §3.4.
 */
export type GatewayErrorCode =
  | 'INVALID_PARAMS'
  | 'AUTHENTICATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'DOWNSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'INTERNAL_ERROR';

/**
 * Stable browser-facing JSON error envelope defined in API Contract v1.1 §3.4.
 */
export interface GatewayErrorBody {
  ok: false;
  error: {
    code: GatewayErrorCode;
    message: string;
  };
  timestamp: string;
}

/**
 * Constructs a Contract v1.1 §3.4 compliant error payload.
 */
export function buildGatewayError(
  code: GatewayErrorCode,
  message: string,
  now: Date = new Date()
): GatewayErrorBody {
  return {
    ok: false,
    error: {
      code,
      message,
    },
    timestamp: now.toISOString(),
  };
}

/**
 * Sends a Contract v1.1 §3.4 error response with optional extra headers (e.g., Retry-After).
 */
export function sendGatewayError(
  reply: FastifyReply,
  statusCode: number,
  code: GatewayErrorCode,
  message: string,
  headers?: Record<string, string>
): FastifyReply {
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      reply.header(key, value);
    }
  }
  return reply.status(statusCode).send(buildGatewayError(code, message));
}
