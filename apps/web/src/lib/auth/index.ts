/**
 * Mock-SSO session handling for the web client (FR-15).
 * In "fixtures" data mode the gateway is replaced by a local stand-in.
 */
import { getDataSourceMode } from '../gateway';
import { createAuthClient, type AuthClient } from './authClient';
import { createFixtureAuthTransport } from './fixtureAuthTransport';

export function createAppAuthClient(): AuthClient {
  if (getDataSourceMode() === 'fixtures') {
    return createAuthClient({ transport: createFixtureAuthTransport() });
  }
  return createAuthClient({ transport: (input, init) => fetch(input, init) });
}

export * from './types';
export * from './personas';
export { safeNextPath } from './redirect';
export { clearSession, loadSession, saveSession, SESSION_STORAGE_KEY } from './sessionStore';
export type { AuthClient } from './authClient';
