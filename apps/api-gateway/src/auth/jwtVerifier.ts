import crypto from 'node:crypto';
import type { JWTPayload, UserRole } from '../types/auth.js';

export const MOCK_JWT_SECRET = process.env.JWT_SECRET || 'campus-orchestrator-test-secret-key-bil481';
export const MOCK_ISSUER = 'https://sso.mock.etu.edu.tr';

/**
 * Base64URL encode buffer or string
 */
function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Base64URL decode to string
 */
function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Signs a mock JWT token with HS256 for test and demonstration personas (FR-07)
 */
export function signMockToken(
  claims: {
    studentId: string;
    name: string;
    email: string;
    role?: UserRole;
  },
  expiresInSeconds: number = 3600,
  secret: string = MOCK_JWT_SECRET
): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: claims.studentId,
    name: claims.name,
    email: claims.email,
    role: claims.role || 'STUDENT',
    iat: now,
    exp: now + expiresInSeconds,
    iss: MOCK_ISSUER,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies a JWT token, checks cryptographic signature and expiry (FR-07)
 */
export function verifyToken(
  rawToken: string,
  secret: string = MOCK_JWT_SECRET
): { valid: boolean; payload?: JWTPayload; error?: string } {
  try {
    const parts = rawToken.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure: must contain 3 segments' };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = base64UrlEncode(
      crypto.createHmac('sha256', secret).update(signatureInput).digest()
    );

    if (encodedSignature !== expectedSignature) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payloadJson = base64UrlDecode(encodedPayload!);
    const payload = JSON.parse(payloadJson) as JWTPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: `Token expired at timestamp ${payload.exp}` };
    }

    if (payload.iss && payload.iss !== MOCK_ISSUER) {
      return { valid: false, error: `Untrusted issuer: expected ${MOCK_ISSUER}` };
    }

    return { valid: true, payload };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown verification failure';
    return { valid: false, error: `Verification error: ${message}` };
  }
}

