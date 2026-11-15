/**
 * User Identity Roles supported by Campus Data Orchestrator
 */
export type UserRole = 'STUDENT' | 'FACULTY' | 'GUEST' | 'ADMIN';

/**
 * Verified JWT Payload issued by Mock-SSO Authority (FR-07)
 */
export interface JWTPayload {
  /** Subject: Unique Student or Staff ID (e.g. '241101066') */
  sub: string;
  /** Full Name of user */
  name: string;
  /** University institutional email */
  email: string;
  /** Role classification */
  role: UserRole;
  /** Token issue epoch timestamp in seconds */
  iat: number;
  /** Token expiration epoch timestamp in seconds */
  exp: number;
  /** Token issuer authority */
  iss: string;
}

/**
 * Sanitized Internal Request Context injected by Gateway pre-handler
 */
export interface AuthenticatedRequestContext {
  /** Verified Student ID or null for unauthenticated guests */
  studentId: string | null;
  /** Verified user role */
  role: UserRole;
  /** Whether session holds a verified authentication token */
  isAuthenticated: boolean;
  /** Timestamp when perimeter verification completed */
  verifiedAt: string;
  /** Client source IP address */
  clientIp: string;
}

/**
 * Gateway Route Rate Limiting Configuration (FR-08)
 */
export interface RateLimitPolicy {
  windowSeconds: number;
  maxRequests: number;
  keyGenerator: (context: AuthenticatedRequestContext) => string;
}

/**
 * Standard Gateway Error Response Structure
 */
export interface GatewayErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  retryAfterSeconds?: number;
}

