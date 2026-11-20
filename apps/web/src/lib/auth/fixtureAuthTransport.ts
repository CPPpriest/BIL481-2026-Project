/**
 * Stand-in for the gateway's mock-SSO endpoints in web "fixtures" mode, so
 * the login flow can be tried without a running gateway. The token it issues
 * is NOT a JWT and is never accepted by the real gateway; its prefix makes
 * that obvious in any screenshot or log.
 */
import { LOGIN_PATH, ME_PATH, type AuthTransport } from './authClient';

export const FIXTURE_TOKEN_PREFIX = 'fixture-token.';

export function createFixtureAuthTransport({ latencyMs = 200 }: { latencyMs?: number } = {}): AuthTransport {
  return async (input, init) => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));

    if (input.endsWith(LOGIN_PATH)) {
      const body = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
      if (typeof body.studentId !== 'string' || typeof body.name !== 'string' || typeof body.email !== 'string') {
        return json(400, { ok: false, error: { code: 'INVALID_PARAMS', message: 'studentId, name and email are required' }, timestamp: new Date().toISOString() });
      }
      return json(200, {
        token: `${FIXTURE_TOKEN_PREFIX}${body.studentId}`,
        user: { studentId: body.studentId, name: body.name, email: body.email, role: body.role ?? 'STUDENT' },
        expiresIn: 3600,
      });
    }

    if (input.endsWith(ME_PATH)) {
      const auth = new Headers(init.headers).get('Authorization') ?? '';
      return auth.startsWith(`Bearer ${FIXTURE_TOKEN_PREFIX}`)
        ? json(200, { authenticated: true })
        : json(401, { ok: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }, timestamp: new Date().toISOString() });
    }

    return json(404, { ok: false, error: { code: 'INVALID_PARAMS', message: 'Unknown path' }, timestamp: new Date().toISOString() });
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
