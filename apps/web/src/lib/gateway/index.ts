/**
 * Entry point for data access in the web app.
 *
 * NEXT_PUBLIC_WEB_DATA_SOURCE selects where card data comes from:
 *   - "gateway"  (default): real requests to /api/v1/*, rewritten to the gateway
 *   - "fixtures": local fixture transport, for UI work before the gateway proxy
 *                 exists. The UI must show a visible banner in this mode.
 *
 * In fixture mode a failure scenario can be forced with the URL parameter
 * `?fixture=stale|upstream-unavailable|rate-limited|network-error`.
 */
import { createGatewayClient, type GatewayClient } from './client';
import { createFixtureTransport, FIXTURE_SCENARIOS, type FixtureScenario } from './fixtureTransport';

export type DataSourceMode = 'gateway' | 'fixtures';

export function getDataSourceMode(): DataSourceMode {
  return process.env.NEXT_PUBLIC_WEB_DATA_SOURCE === 'fixtures' ? 'fixtures' : 'gateway';
}

export function getFixtureScenario(search: string): FixtureScenario {
  const value = new URLSearchParams(search).get('fixture');
  return FIXTURE_SCENARIOS.includes(value as FixtureScenario) ? (value as FixtureScenario) : 'normal';
}

/** Creates the client for the current mode. Call from client components only. */
export function createAppGatewayClient(): GatewayClient {
  if (getDataSourceMode() === 'fixtures') {
    const scenario = typeof window === 'undefined' ? 'normal' : getFixtureScenario(window.location.search);
    return createGatewayClient({ transport: createFixtureTransport({ scenario }) });
  }
  return createGatewayClient({ transport: (input, init) => fetch(input, init) });
}

export * from './types';
export type { GatewayClient, QueryOptions } from './client';
export type { FixtureScenario } from './fixtureTransport';
