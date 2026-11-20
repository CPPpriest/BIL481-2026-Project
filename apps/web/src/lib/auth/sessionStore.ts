/**
 * Keeps the mock-SSO session for the current browser tab only
 * (API Contract v1.1 §1 "Browser token storage": sessionStorage, never
 * localStorage, cookies, URLs or logs). Storage can be unavailable (private
 * mode, blocked site data), so every access is guarded and the app then
 * simply behaves as a guest.
 */
import type { StoredSession } from './types';

export const SESSION_STORAGE_KEY = 'campus.session';

/** Minimal Storage interface so tests can pass an in-memory implementation. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Returns the stored session, or null when there is none, it is malformed or it has expired. */
export function loadSession(storage: KeyValueStorage | null = browserStorage(), nowMs: number = Date.now()): StoredSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSession>;
    const user = value.user;
    const valid =
      typeof value.token === 'string' &&
      typeof value.expiresAt === 'number' &&
      typeof user === 'object' &&
      user !== null &&
      typeof user.studentId === 'string' &&
      typeof user.name === 'string' &&
      typeof user.email === 'string' &&
      typeof user.role === 'string';
    if (!valid || value.expiresAt! <= nowMs) {
      storage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return value as StoredSession;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession, storage: KeyValueStorage | null = browserStorage()): void {
  try {
    storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage full or blocked: the session then lasts only until reload.
  }
}

export function clearSession(storage: KeyValueStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
