/**
 * Session types for mock-SSO login (FR-15, API Contract v1.1 §3.1).
 * This is development/demo authentication, not real TOBB ETÜ SSO.
 */

export type UserRole = 'STUDENT' | 'FACULTY' | 'GUEST' | 'ADMIN';

export interface SessionUser {
  studentId: string;
  name: string;
  email: string;
  role: UserRole;
}

/** What is kept in sessionStorage for the current tab (contract v1.1 §1 "Browser token storage"). */
export interface StoredSession {
  token: string;
  user: SessionUser;
  /** Epoch milliseconds after which the token is treated as expired. */
  expiresAt: number;
}

export type AuthErrorCode =
  | 'INVALID_PARAMS'
  | 'AUTHENTICATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'DOWNSTREAM_ERROR'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

export type LoginResult =
  | { ok: true; session: StoredSession }
  | { ok: false; code: AuthErrorCode; message: string; status?: number; retryAfterSeconds?: number };

/** Result of checking a stored token with the gateway (`GET /api/v1/auth/me`). */
export type VerifyResult = 'valid' | 'invalid' | 'unreachable';
