'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  clearSession,
  createAppAuthClient,
  findPersona,
  loadSession,
  saveSession,
  type LoginResult,
  type StoredSession,
} from '@/lib/auth';

/** Why the last session ended without the user pressing "Çıkış". */
export type SessionEndReason = 'expired' | 'invalid';

export type SessionState =
  | { status: 'loading' }
  | { status: 'guest'; endReason: SessionEndReason | null }
  | { status: 'authenticated'; session: StoredSession };

interface SessionContextValue {
  state: SessionState;
  login(personaId: string): Promise<LoginResult>;
  logout(): void;
  /** Called by data clients when the gateway answers 401 for the current token. */
  reportUnauthorized(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Holds the mock-SSO session for the whole app (FR-15). Public pages work
 * the same for guests; only the assistant needs a session (contract v1.1 §1).
 * The first render is always "loading" so server and browser HTML match.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const authClient = useMemo(() => createAppAuthClient(), []);
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const endSession = useCallback((endReason: SessionEndReason | null) => {
    clearTimeout(expiryTimer.current);
    clearSession();
    setState({ status: 'guest', endReason });
  }, []);

  const startSession = useCallback(
    (session: StoredSession) => {
      clearTimeout(expiryTimer.current);
      // setTimeout cannot wait longer than ~24.8 days; tokens live 1 hour.
      expiryTimer.current = setTimeout(() => endSession('expired'), Math.max(0, session.expiresAt - Date.now()));
      setState({ status: 'authenticated', session });
    },
    [endSession]
  );

  useEffect(() => {
    const stored = loadSession();
    if (!stored) {
      setState({ status: 'guest', endReason: null });
      return;
    }
    startSession(stored);
    // Re-check the stored token with the gateway; an unreachable gateway keeps the session.
    let cancelled = false;
    authClient.verify(stored.token).then((result) => {
      if (!cancelled && result === 'invalid') endSession('invalid');
    });
    return () => {
      cancelled = true;
    };
  }, [authClient, startSession, endSession]);

  useEffect(() => () => clearTimeout(expiryTimer.current), []);

  const login = useCallback(
    async (personaId: string): Promise<LoginResult> => {
      const persona = findPersona(personaId);
      if (!persona) return { ok: false, code: 'INVALID_PARAMS', message: 'Bilinmeyen demo kullanıcısı.' };
      const result = await authClient.login(persona);
      if (result.ok) {
        saveSession(result.session);
        startSession(result.session);
      }
      return result;
    },
    [authClient, startSession]
  );

  const logout = useCallback(() => endSession(null), [endSession]);
  const reportUnauthorized = useCallback(() => endSession('invalid'), [endSession]);

  const value = useMemo(() => ({ state, login, logout, reportUnauthorized }), [state, login, logout, reportUnauthorized]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
