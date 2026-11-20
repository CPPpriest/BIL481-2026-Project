/**
 * Client for the gateway's mock-SSO endpoints (API Contract v1.1 §3.1):
 *   POST /api/v1/auth/mock-login  -> { token, user, expiresIn }
 *   GET  /api/v1/auth/me          -> 200 when the token is valid, 401 otherwise
 *
 * Error bodies are read in the contract format (§3.4). The gateway currently
 * still answers some errors as `{ statusCode, error, message }`; in that case
 * the error type is derived from the HTTP status so the UI behaves the same.
 */
import type { AuthErrorCode, LoginResult, SessionUser, StoredSession, UserRole, VerifyResult } from './types';

export type AuthTransport = (input: string, init: RequestInit) => Promise<Response>;

export interface AuthClient {
  login(user: SessionUser): Promise<LoginResult>;
  verify(token: string): Promise<VerifyResult>;
}

export const LOGIN_PATH = '/api/v1/auth/mock-login';
export const ME_PATH = '/api/v1/auth/me';
const TIMEOUT_MS = 10_000;

const ROLES: readonly UserRole[] = ['STUDENT', 'FACULTY', 'GUEST', 'ADMIN'];

const MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_PARAMS: 'Giriş bilgileri geçersiz.',
  AUTHENTICATION_REQUIRED: 'Giriş yapılamadı.',
  RATE_LIMITED: 'Çok fazla deneme yapıldı.',
  DOWNSTREAM_ERROR: 'Giriş servisine şu an ulaşılamıyor.',
  INTERNAL_ERROR: 'Beklenmeyen bir hata oluştu.',
  NETWORK_ERROR: 'Sunucuya ulaşılamadı. Bağlantını kontrol et.',
  INVALID_RESPONSE: 'Sunucudan beklenmeyen bir cevap geldi.',
};

export function createAuthClient({
  transport,
  baseUrl = '',
  now = () => Date.now(),
}: {
  transport: AuthTransport;
  baseUrl?: string;
  now?: () => number;
}): AuthClient {
  async function request(path: string, init: RequestInit): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await transport(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function login(user: SessionUser): Promise<LoginResult> {
    const response = await request(LOGIN_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ studentId: user.studentId, name: user.name, email: user.email, role: user.role }),
    });
    if (response === null) return failure('NETWORK_ERROR');

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure(response.status >= 500 ? 'NETWORK_ERROR' : 'INVALID_RESPONSE', response.status);
    }

    if (!response.ok) return errorFromResponse(response, body);

    const session = parseLoginBody(body, now());
    return session ? { ok: true, session } : failure('INVALID_RESPONSE', response.status);
  }

  async function verify(token: string): Promise<VerifyResult> {
    const response = await request(ME_PATH, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (response === null) return 'unreachable';
    if (response.status === 401) return 'invalid';
    return response.ok ? 'valid' : 'unreachable';
  }

  return { login, verify };
}

function parseLoginBody(body: unknown, nowMs: number): StoredSession | null {
  if (typeof body !== 'object' || body === null) return null;
  const { token, user, expiresIn } = body as Record<string, unknown>;
  if (typeof token !== 'string' || token.length === 0 || typeof expiresIn !== 'number' || expiresIn <= 0) return null;
  if (typeof user !== 'object' || user === null) return null;
  const { studentId, name, email, role } = user as Record<string, unknown>;
  if (typeof studentId !== 'string' || typeof name !== 'string' || typeof email !== 'string' || !ROLES.includes(role as UserRole)) {
    return null;
  }
  return { token, user: { studentId, name, email, role: role as UserRole }, expiresAt: nowMs + expiresIn * 1000 };
}

function errorFromResponse(response: Response, body: unknown): LoginResult {
  const contractCode = (body as { ok?: unknown; error?: { code?: unknown } } | null)?.error?.code;
  let code: AuthErrorCode;
  if ((body as { ok?: unknown } | null)?.ok === false && typeof contractCode === 'string' && contractCode in MESSAGES) {
    code = contractCode as AuthErrorCode;
  } else if (response.status === 400) code = 'INVALID_PARAMS';
  else if (response.status === 401 || response.status === 403) code = 'AUTHENTICATION_REQUIRED';
  else if (response.status === 429) code = 'RATE_LIMITED';
  else if (response.status === 502 || response.status === 503 || response.status === 504) code = 'DOWNSTREAM_ERROR';
  else code = 'INTERNAL_ERROR';

  const result = failure(code, response.status);
  const retryAfter = Number(response.headers.get('Retry-After'));
  if (!result.ok && response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
    result.retryAfterSeconds = retryAfter;
  }
  return result;
}

function failure(code: AuthErrorCode, status?: number): LoginResult {
  return status === undefined ? { ok: false, code, message: MESSAGES[code] } : { ok: false, code, message: MESSAGES[code], status };
}
