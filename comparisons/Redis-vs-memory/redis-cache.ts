/**
 * OPTION B — shared Redis cache (demonstrative snippet). SELECTED.
 *
 * Comparison: Redis vs process in-memory Map for the MCP tool cache (FR-09, FR-10).
 * The production-quality version of this option lives in
 * packages/connectors/src/cache/RedisCacheStore.ts.
 *
 * Strengths shown by this code:
 *   1. Every MCP server instance talks to the same Redis, so a value fetched by instance 1 is a
 *      cache hit for instance 2 (NFR-02 hit ratio, NFR-04 stateless instances).
 *   2. `PX` makes Redis itself delete the key after 3 × TTL (bounded memory, no lazy cleanup code),
 *      while `freshUntil` inside the value decides fresh vs stale (FR-09, FR-10).
 *   3. Cached values survive an MCP server restart, so stale fallback still works right after a redeploy.
 *   4. The gateway already needs Redis for atomic rate-limit counters (FR-08), so no new infrastructure.
 * Costs: one network round trip per lookup, one more container to run, and the app must tolerate
 * Redis being down (the executor treats cache errors as a miss).
 *
 * Status: snippet and adapter are unit-tested with a fake client; not yet run against a live Redis
 * server. The connection bootstrap below is the planned Phase 3 wiring.
 */

/** Same minimal client contract as packages/connectors (matches node-redis v4+). */
export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { PX: number }): Promise<unknown>;
}

interface StoredValue<T> {
  value: T;
  cachedAt: string;
  freshUntil: string;
}

export class RedisToolCache<T> {
  constructor(
    private readonly client: RedisLikeClient,
    private readonly now: () => number = Date.now
  ) {}

  public async set(key: string, value: T, ttlSeconds: number): Promise<void> {
    const nowMs = this.now();
    const stored: StoredValue<T> = {
      value,
      cachedAt: new Date(nowMs).toISOString(),
      freshUntil: new Date(nowMs + ttlSeconds * 1000).toISOString(),
    };
    // Redis expires the key itself after 3 × TTL.
    await this.client.set(key, JSON.stringify(stored), { PX: 3 * ttlSeconds * 1000 });
  }

  public async get(key: string): Promise<{ value: T; isStale: boolean; cachedAt: string } | null> {
    const raw = await this.client.get(key);
    if (raw === null) {
      return null;
    }
    const stored = JSON.parse(raw) as StoredValue<T>;
    return { value: stored.value, isStale: this.now() >= Date.parse(stored.freshUntil), cachedAt: stored.cachedAt };
  }
}

// Planned Phase 3 bootstrap (requires the `redis` npm package and the Redis container):
//
//   import { createClient } from 'redis';
//   const client = createClient({ url: process.env.REDIS_URL });   // redis://localhost:6379
//   client.on('error', (err) => console.error('[redis]', err.message));
//   await client.connect();
//   const cache = new RedisToolCache<CafeteriaDailyMenu>(client);
//   await cache.set('cache:dining:2026-11-16', menu, 3600);        // visible to ALL instances
