import crypto from 'node:crypto';
import type { JWTPayload, UserRole } from '../types/auth.js';

const DEV_FALLBACK_JWT_SECRET = 'campus-orchestrator-test-secret-key-bil481';
const DEFAULT_MOCK_ISSUER = 'campus-mock-sso';
const VALID_ROLES: readonly UserRole[] = ['STUDENT', 'FACULTY', 'GUEST', 'ADMIN'];

export const MOCK_JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_JWT_SECRET;
export const MOCK_ISSUER = process.env.MOCK_SSO_ISSUER || DEFAULT_MOCK_ISSUER;

/**
 * Resolves the active HMAC secret from environment.
 * Production environments must provide JWT_SECRET explicitly.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  }
  return DEV_FALLBACK_JWT_SECRET;
}

/**
 * Resolves the expected mock-SSO issuer claim from environment.
 */
export function getMockIssuer(): string {
  const issuer = process.env.MOCK_SSO_ISSUER?.trim();
  return issuer || DEFAULT_MOCK_ISSUER;
}

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
  secret: string = getJwtSecret(),
  issuer: string = getMockIssuer()
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
    iss: issuer,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies a JWT token, checking header algorithm, timing-safe HMAC signature, claims, expiry, and issuer (FR-07)
 */
export function verifyToken(
  rawToken: string,
  secret: string = getJwtSecret(),
  expectedIssuer: string = getMockIssuer()
): { valid: boolean; payload?: JWTPayload; error?: string } {
  try {
    if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      return { valid: false, error: 'Malformed token structure' };
    }

    const parts = rawToken.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure: must contain 3 segments' };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      return { valid: false, error: 'Malformed token structure: empty segment' };
    }

    const headerRaw = JSON.parse(base64UrlDecode(encodedHeader)) as unknown;
    if (
      typeof headerRaw !== 'object' ||
      headerRaw === null ||
      Array.isArray(headerRaw) ||
      (headerRaw as { alg?: unknown }).alg !== 'HS256'
    ) {
      return { valid: false, error: 'Unsupported token algorithm' };
    }

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = base64UrlEncode(
      crypto.createHmac('sha256', secret).update(signatureInput).digest()
    );

    const actualSigBuf = Buffer.from(encodedSignature, 'utf-8');
    const expectedSigBuf = Buffer.from(expectedSignature, 'utf-8');
    if (
      actualSigBuf.length !== expectedSigBuf.length ||
      !crypto.timingSafeEqual(actualSigBuf, expectedSigBuf)
    ) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payloadRaw = JSON.parse(base64UrlDecode(encodedPayload)) as unknown;
    if (typeof payloadRaw !== 'object' || payloadRaw === null || Array.isArray(payloadRaw)) {
      return { valid: false, error: 'Malformed token payload' };
    }

    const payload = payloadRaw as Partial<JWTPayload>;
    if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
      return { valid: false, error: 'Missing or invalid subject claim' };
    }

    if (typeof payload.role !== 'string' || !VALID_ROLES.includes(payload.role as UserRole)) {
      return { valid: false, error: 'Missing or invalid role claim' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return { valid: false, error: 'Missing or invalid expiration claim' };
    }
    if (payload.exp <= now) {
      return { valid: false, error: 'Token expired' };
    }

    if (typeof payload.iss !== 'string' || payload.iss !== expectedIssuer) {
      return { valid: false, error: 'Untrusted token issuer' };
    }

    return {
      valid: true,
      payload: {
        sub: payload.sub.trim(),
        name: typeof payload.name === 'string' ? payload.name : '',
        email: typeof payload.email === 'string' ? payload.email : '',
        role: payload.role as UserRole,
        iat: typeof payload.iat === 'number' ? payload.iat : now,
        exp: payload.exp,
        iss: payload.iss,
      },
    };
  } catch {
    return { valid: false, error: 'Token verification failed' };
  }
}
