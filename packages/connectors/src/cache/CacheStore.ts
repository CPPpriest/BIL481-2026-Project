/**
 * Cache adapter contract (FR-09, FR-10).
 *
 * A cache entry carries its own freshness boundary (`freshUntil`) while the store keeps it
 * physically for a longer retention period (3 × TTL). Between `freshUntil` and the end of
 * retention the entry is no longer served as fresh, but it is still available as the
 * stale-if-error fallback.
 *
 * Two implementations share this contract:
 * - InMemoryCacheStore: process-local Map; used by tests, offline development and the demo.
 * - RedisCacheStore: shared Redis instance; the production target (Phase 3 wiring).
 */

export interface CacheEntry<T> {
  value: T;
  /** ISO timestamp of when the value was fetched from the connector (reported as `timestamp` when stale). */
  cachedAt: string;
  /** ISO timestamp after which the value must not be served as fresh. */
  freshUntil: string;
}

export interface CacheStore {
  /** Returns the entry if it is still physically retained, otherwise null. */
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  /** Stores the entry and keeps it for `retentionSeconds` (≥ TTL). */
  set<T>(key: string, entry: CacheEntry<T>, retentionSeconds: number): Promise<void>;
  /** Removes one key (used by tests and manual invalidation). */
  delete(key: string): Promise<void>;
}
