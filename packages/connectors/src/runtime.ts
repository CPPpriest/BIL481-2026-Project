/**
 * One-call bootstrap for the MCP server (integration helper for Murat).
 *
 *   const runtime = createConnectorRuntime();            // reads process.env
 *   registerConnectorHandlers(dispatcher, runtime);       // replaces the temporary sample handlers
 *
 * Cache store: until the Redis client is wired (Phase 3), the runtime uses an InMemoryCacheStore.
 * Pass `cache: new RedisCacheStore(redisClient)` to switch to the shared Redis cache with no other change.
 */

import type { CacheStore } from './cache/CacheStore.js';
import { InMemoryCacheStore } from './cache/InMemoryCacheStore.js';
import { loadConnectorConfig, type ConnectorRuntimeConfig, type EnvSource } from './config.js';
import { createCampusConnectors } from './factory.js';
import type { ConnectorHandlerDeps } from './handlers.js';
import { ResilientConnectorExecutor } from './resilience/ResilientConnectorExecutor.js';
import { systemClock, type Clock } from './types.js';

export interface ConnectorRuntimeOptions {
  env?: EnvSource;
  cache?: CacheStore;
  clock?: Clock;
}

export interface ConnectorRuntime extends ConnectorHandlerDeps {
  config: ConnectorRuntimeConfig;
  cache: CacheStore;
}

export function createConnectorRuntime(options: ConnectorRuntimeOptions = {}): ConnectorRuntime {
  const clock = options.clock ?? systemClock;
  const config = loadConnectorConfig(options.env ?? process.env);
  const cache = options.cache ?? new InMemoryCacheStore(clock);
  const connectors = createCampusConnectors(config, clock);
  const executor = new ResilientConnectorExecutor({ cache, clock, timeoutMs: config.upstreamTimeoutMs });
  return { config, cache, connectors, executor, ttlSeconds: config.ttlSeconds, clock };
}
