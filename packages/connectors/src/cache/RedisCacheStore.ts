/**
 * Redis-backed cache store (FR-09 production target).
 *
 * The adapter depends only on a minimal client interface instead of importing a Redis library,
 * so the package builds and its tests run offline (NFR-08). The interface matches the official
 * `redis` (node-redis v4+) client: `get(key)` and `set(key, value, { PX })`.
 *
 * Status: implemented and unit-tested against an in-memory fake client. It has NOT yet been run
 * against a real Redis server; adding the `redis` dependency, the Redis container in Docker Compose
 * and the connection bootstrap is planned for Phase 3 (see docs/_sections/arda-data-decisions.md).
 */

import type { CacheEntry, CacheStore } from './CacheStore.js';

/** Subset of the node-redis client used by the cache adapter. */
export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { PX: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class RedisCacheStore implements CacheStore {
  constructor(private readonly client: RedisLikeClient) {}

  public async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const raw = await this.client.get(key);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      // A corrupted value must behave like a miss rather than break the tool call.
      return null;
    }
  }

  public async set<T>(key: string, entry: CacheEntry<T>, retentionSeconds: number): Promise<void> {
    // PX = physical retention in milliseconds (3 × TTL); freshness is decided by entry.freshUntil.
    await this.client.set(key, JSON.stringify(entry), { PX: Math.round(retentionSeconds * 1000) });
  }

  public async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
