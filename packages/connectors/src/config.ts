/**
 * Environment-driven connector configuration (FR-09, FR-10, FR-12).
 *
 * Variable names match the repository's `.env.example`:
 *   CAFETERIA_CONNECTOR_MODE, SHUTTLE_CONNECTOR_MODE, LIBRARY_CONNECTOR_MODE, SCHEDULE_CONNECTOR_MODE
 *   UPSTREAM_TIMEOUT_MS
 *   CACHE_TTL_CAFETERIA, CACHE_TTL_SHUTTLE, CACHE_TTL_LIBRARY, CACHE_TTL_COURSE_SCHEDULE
 * One optional variable is introduced by the connector tier:
 *   CONNECTOR_MOCK_SEED (default '481-FALL-2026')
 *
 * Configuration is read once when the connector set is created, so switching a mode
 * only requires changing the variable and restarting the process (FR-12 acceptance).
 */

import { CACHE_TTL } from '@campus-orchestrator/shared';
import type { ConnectorMode, ConnectorName } from './types.js';

export type EnvSource = Record<string, string | undefined>;

export const CONNECTOR_MODE_ENV: Readonly<Record<ConnectorName, string>> = {
  cafeteria: 'CAFETERIA_CONNECTOR_MODE',
  shuttle: 'SHUTTLE_CONNECTOR_MODE',
  library: 'LIBRARY_CONNECTOR_MODE',
  courseSchedule: 'SCHEDULE_CONNECTOR_MODE',
};

export const CACHE_TTL_ENV: Readonly<Record<ConnectorName, string>> = {
  cafeteria: 'CACHE_TTL_CAFETERIA',
  shuttle: 'CACHE_TTL_SHUTTLE',
  library: 'CACHE_TTL_LIBRARY',
  courseSchedule: 'CACHE_TTL_COURSE_SCHEDULE',
};

/** Default TTLs in seconds, taken from the shared contract (FR-09): 3600 / 120 / 60 / 300. */
export const DEFAULT_CACHE_TTL_SECONDS: Readonly<Record<ConnectorName, number>> = {
  cafeteria: CACHE_TTL.CAFETERIA,
  shuttle: CACHE_TTL.SHUTTLE,
  library: CACHE_TTL.LIBRARY,
  courseSchedule: CACHE_TTL.COURSE_SCHEDULE,
};

export const MOCK_SEED_ENV = 'CONNECTOR_MOCK_SEED';
export const DEFAULT_MOCK_SEED = '481-FALL-2026';

export const UPSTREAM_TIMEOUT_ENV = 'UPSTREAM_TIMEOUT_MS';
/** Upstream cutoff from NFR-01 / FR-10. */
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 800;

/** Cached values are physically kept for 3 × TTL so they can serve as stale fallback (FR-09). */
export const CACHE_RETENTION_MULTIPLIER = 3;

/** Circuit breaker policy from FR-11. */
export const CIRCUIT_FAILURE_THRESHOLD = 3;
export const CIRCUIT_COOLDOWN_MS = 60_000;

export class ConnectorConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectorConfigError';
  }
}

export interface ConnectorRuntimeConfig {
  modes: Record<ConnectorName, ConnectorMode>;
  ttlSeconds: Record<ConnectorName, number>;
  mockSeed: string;
  upstreamTimeoutMs: number;
}

/** Reads the mode of one connector. Missing → 'mock' (safe default); any other value fails fast. */
export function resolveConnectorMode(name: ConnectorName, env: EnvSource): ConnectorMode {
  const variable = CONNECTOR_MODE_ENV[name];
  const raw = env[variable]?.trim().toLowerCase();
  if (raw === undefined || raw === '') {
    return 'mock';
  }
  if (raw === 'mock' || raw === 'live') {
    return raw;
  }
  throw new ConnectorConfigError(`${variable} must be 'mock' or 'live' (received '${env[variable]}')`);
}

function readPositiveInteger(env: EnvSource, variable: string, fallback: number): number {
  const raw = env[variable]?.trim();
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ConnectorConfigError(`${variable} must be a positive integer (received '${raw}')`);
  }
  return value;
}

/** Builds the full runtime configuration from an environment object (defaults to `process.env`). */
export function loadConnectorConfig(env: EnvSource = process.env): ConnectorRuntimeConfig {
  const modes = {} as Record<ConnectorName, ConnectorMode>;
  const ttlSeconds = {} as Record<ConnectorName, number>;
  for (const name of Object.keys(CONNECTOR_MODE_ENV) as ConnectorName[]) {
    modes[name] = resolveConnectorMode(name, env);
    ttlSeconds[name] = readPositiveInteger(env, CACHE_TTL_ENV[name], DEFAULT_CACHE_TTL_SECONDS[name]);
  }
  const seed = env[MOCK_SEED_ENV]?.trim();
  return {
    modes,
    ttlSeconds,
    mockSeed: seed && seed.length > 0 ? seed : DEFAULT_MOCK_SEED,
    upstreamTimeoutMs: readPositiveInteger(env, UPSTREAM_TIMEOUT_ENV, DEFAULT_UPSTREAM_TIMEOUT_MS),
  };
}
