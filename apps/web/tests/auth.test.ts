import { describe, expect, it } from 'vitest';
import { createAuthClient, LOGIN_PATH, ME_PATH, type AuthTransport } from '../src/lib/auth/authClient';
import { createFixtureAuthTransport, FIXTURE_TOKEN_PREFIX } from '../src/lib/auth/fixtureAuthTransport';
import { DEMO_PERSONAS } from '../src/lib/auth/personas';
import { safeNextPath } from '../src/lib/auth/redirect';
import { clearSession, loadSession, saveSession, SESSION_STORAGE_KEY, type KeyValueStorage } from '../src/lib/auth/sessionStore';
import type { StoredSession } from '../src/lib/auth/types';

/** Y-08 / FR-15: mock-SSO login, session storage and safe return paths. */

const NOW = Date.parse('2026-11-23T06:00:00.000Z');
const persona = DEMO_PERSONAS[0]!;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('auth client — login (POST /api/v1/auth/mock-login)', () => {
  it('returns a session with the user and an absolute expiry from expiresIn', async () => {
    const transport: AuthTransport = async () =>
      json(200, { token: 'eyJ.synthetic.token', user: { ...persona, id: undefined }, expiresIn: 3600 });
    const result = await createAuthClient({ transport, now: () => NOW }).login(persona);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.token).toBe('eyJ.synthetic.token');
    expect(result.session.user).toEqual({ studentId: 'demo-student-01', name: 'Demo Öğrenci 1', email: 'demo1@example.test', role: 'STUDENT' });
    expect(result.session.expiresAt).toBe(NOW + 3_600_000);
  });

  it('sends only the persona fields, as JSON, without an Authorization header', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const transport: AuthTransport = async (url, init) => {
      seen = { url, init };
      return json(200, { token: 't', user: persona, expiresIn: 3600 });
    };
    await createAuthClient({ transport }).login(persona);

    expect(seen?.url).toBe(LOGIN_PATH);
    expect(seen?.init.method).toBe('POST');
    expect(JSON.parse(String(seen?.init.body))).toEqual({
      studentId: 'demo-student-01',
      name: 'Demo Öğrenci 1',
      email: 'demo1@example.test',
      role: 'STUDENT',
    });
    expect(new Headers(seen?.init.headers).has('Authorization')).toBe(false);
  });

  it('reads contract-format errors (§3.4)', async () => {
    const transport: AuthTransport = async () =>
      json(429, { ok: false, error: { code: 'RATE_LIMITED', message: 'slow down' }, timestamp: 'x' }, { 'Retry-After': '30' });
    expect(await createAuthClient({ transport }).login(persona)).toMatchObject({
      ok: false,
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterSeconds: 30,
    });
  });

  it('maps the current gateway error format { statusCode, error, message } by HTTP status', async () => {
    const transport: AuthTransport = async () =>
      json(400, { statusCode: 400, error: 'Bad Request', message: 'studentId, name, and email are required' });
    expect(await createAuthClient({ transport }).login(persona)).toMatchObject({ ok: false, code: 'INVALID_PARAMS', status: 400 });
  });

  it('reports network failures and unreachable gateways', async () => {
    const offline: AuthTransport = async () => {
      throw new TypeError('Failed to fetch');
    };
    const down: AuthTransport = async () => new Response('Internal Server Error', { status: 500 });

    expect(await createAuthClient({ transport: offline }).login(persona)).toMatchObject({ ok: false, code: 'NETWORK_ERROR' });
    expect(await createAuthClient({ transport: down }).login(persona)).toMatchObject({ ok: false, code: 'NETWORK_ERROR', status: 500 });
  });

  it('rejects a 200 answer without a usable token', async () => {
    const transport: AuthTransport = async () => json(200, { token: '', user: persona, expiresIn: 3600 });
    expect(await createAuthClient({ transport }).login(persona)).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
  });
});

describe('auth client — verify (GET /api/v1/auth/me)', () => {
  it('distinguishes valid, invalid and unreachable', async () => {
    const seenHeaders: Headers[] = [];
    const make = (response: Response | Error): AuthTransport => async (url, init) => {
      expect(url).toBe(ME_PATH);
      seenHeaders.push(new Headers(init.headers));
      if (response instanceof Error) throw response;
      return response;
    };

    expect(await createAuthClient({ transport: make(json(200, { authenticated: true })) }).verify('tok')).toBe('valid');
    expect(await createAuthClient({ transport: make(json(401, { statusCode: 401 })) }).verify('tok')).toBe('invalid');
    expect(await createAuthClient({ transport: make(new TypeError('offline')) }).verify('tok')).toBe('unreachable');
    expect(await createAuthClient({ transport: make(json(503, {})) }).verify('tok')).toBe('unreachable');
    expect(seenHeaders[0]?.get('Authorization')).toBe('Bearer tok');
  });
});

describe('fixture auth transport', () => {
  it('issues an obviously fake token that it accepts, and rejects anything else', async () => {
    const client = createAuthClient({ transport: createFixtureAuthTransport({ latencyMs: 0 }) });
    const result = await client.login(persona);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.token.startsWith(FIXTURE_TOKEN_PREFIX)).toBe(true);
    expect(await client.verify(result.session.token)).toBe('valid');
    expect(await client.verify('eyJ.real.looking')).toBe('invalid');
  });
});

describe('session store (sessionStorage, contract v1.1 §1)', () => {
  const session: StoredSession = {
    token: 'synthetic',
    user: { studentId: 'demo-student-01', name: 'Demo Öğrenci 1', email: 'demo1@example.test', role: 'STUDENT' },
    expiresAt: NOW + 60_000,
  };

  it('saves, loads and clears a session', () => {
    const storage = memoryStorage();
    saveSession(session, storage);
    expect(loadSession(storage, NOW)).toEqual(session);
    clearSession(storage);
    expect(loadSession(storage, NOW)).toBeNull();
  });

  it('drops an expired or malformed session', () => {
    const storage = memoryStorage();
    saveSession(session, storage);
    expect(loadSession(storage, NOW + 60_000)).toBeNull();
    expect(storage.data.has(SESSION_STORAGE_KEY)).toBe(false);

    storage.setItem(SESSION_STORAGE_KEY, '{"token":"x"}');
    expect(loadSession(storage, NOW)).toBeNull();
    storage.setItem(SESSION_STORAGE_KEY, 'not json');
    expect(loadSession(storage, NOW)).toBeNull();
  });

  it('behaves as a guest when storage is unavailable or throws', () => {
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSession(null, NOW)).toBeNull();
    expect(loadSession(throwing, NOW)).toBeNull();
    expect(() => saveSession(session, throwing)).not.toThrow();
    expect(() => clearSession(throwing)).not.toThrow();
  });
});

describe('safeNextPath (no open redirect after login)', () => {
  it('keeps same-site paths', () => {
    expect(safeNextPath('/asistan')).toBe('/asistan');
    expect(safeNextPath('/?fixture=stale')).toBe('/?fixture=stale');
  });

  it('falls back for missing, external or tricky values', () => {
    for (const value of [null, '', 'asistan', 'https://evil.example', '//evil.example', '/\\evil.example', '/a\nb']) {
      expect(safeNextPath(value)).toBe('/asistan');
    }
  });
});
