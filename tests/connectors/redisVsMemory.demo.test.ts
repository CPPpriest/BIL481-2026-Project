/**
 * Executable demonstration for comparisons/Redis-vs-memory (Design Decision 4.1).
 *
 * Scenario: two MCP server instances behind the gateway (NFR-04) serve the same cafeteria query,
 * then one instance restarts while the upstream is down.
 * - Option A: each instance has its own InMemoryCacheStore (process Map).
 * - Option B: both instances share one store, standing in for a single Redis instance.
 *   (A shared fake is used because no Redis server runs in the test environment; this demonstrates
 *   sharing semantics only and measures no latency.)
 * The numbers asserted below are upstream call counts, i.e. functional behaviour, not performance.
 */

import { describe, expect, it } from 'vitest';
import {
  cafeteriaCacheKey,
  FaultInjectingConnector,
  InMemoryCacheStore,
  MockCafeteriaConnector,
  RedisCacheStore,
  ResilientConnectorExecutor,
  type CacheStore,
  type RedisLikeClient,
} from '../../packages/connectors/src/index.js';
import { MONDAY, SEED, TestClock } from './helpers.js';

class SharedFakeRedis implements RedisLikeClient {
  private readonly data = new Map<string, { value: string; expiresAtMs: number }>();
  constructor(private readonly clock: TestClock) {}
  public async get(key: string) {
    const item = this.data.get(key);
    return item && this.clock.now().getTime() < item.expiresAtMs ? item.value : null;
  }
  public async set(key: string, value: string, options: { PX: number }) {
    this.data.set(key, { value, expiresAtMs: this.clock.now().getTime() + options.PX });
    return 'OK';
  }
  public async del(key: string) {
    return this.data.delete(key) ? 1 : 0;
  }
}

function scenario(storeFor: (instance: number) => CacheStore, clock: TestClock) {
  const upstream = new FaultInjectingConnector(new MockCafeteriaConnector(SEED, clock.now));
  const makeInstance = (n: number) => new ResilientConnectorExecutor({ cache: storeFor(n), clock: clock.now });
  const call = (executor: ResilientConnectorExecutor) =>
    executor.execute({
      connectorName: 'cafeteria',
      connector: upstream,
      input: { date: MONDAY },
      cacheKey: cafeteriaCacheKey(MONDAY),
      ttlSeconds: 3600,
    });
  return { upstream, makeInstance, call };
}

describe('Design Decision: Redis (shared) vs process Map (per instance)', () => {
  it('Option A — Map per instance: every instance misses; a restart loses the stale fallback', async () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    const { upstream, makeInstance, call } = scenario(() => new InMemoryCacheStore(clock.now), clock);
    const instance1 = makeInstance(1);
    const instance2 = makeInstance(2);

    expect((await call(instance1)).source).toBe('LIVE');
    expect((await call(instance2)).source).toBe('LIVE'); // instance 2 cannot see instance 1's cache
    expect(upstream.upstreamCalls).toBe(2);

    clock.advanceSeconds(3700);
    upstream.failAlways();
    const restarted1 = makeInstance(1); // redeploy → new empty Map
    expect((await call(restarted1)).source).toBe('ERROR'); // nothing to fall back on
  });

  it('Option B — shared store (Redis semantics): second instance hits; stale fallback survives restart', async () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    const redis = new SharedFakeRedis(clock);
    const { upstream, makeInstance, call } = scenario(() => new RedisCacheStore(redis), clock);
    const instance1 = makeInstance(1);
    const instance2 = makeInstance(2);

    expect((await call(instance1)).source).toBe('LIVE');
    expect((await call(instance2)).source).toBe('CACHE_HIT');
    expect(upstream.upstreamCalls).toBe(1);

    clock.advanceSeconds(3700);
    upstream.failAlways();
    const restarted1 = makeInstance(1);
    const result = await call(restarted1);
    expect(result).toMatchObject({ source: 'STALE', isStale: true });
  });
});
