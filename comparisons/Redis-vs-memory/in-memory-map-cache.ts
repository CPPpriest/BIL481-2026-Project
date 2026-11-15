/**
 * OPTION A — process-local Map cache (demonstrative snippet).
 *
 * Comparison: Redis vs process in-memory Map for the MCP tool cache (FR-09, FR-10).
 * The production-quality version of this option lives in
 * packages/connectors/src/cache/InMemoryCacheStore.ts and is used for tests/offline runs.
 *
 * Strengths: zero infrastructure, no network hop, trivially testable.
 * Weaknesses shown by this code:
 *   1. `entries` belongs to ONE Node.js process. A second MCP server instance has its own empty Map,
 *      so it misses the cache and calls the campus connector again (NFR-02 hit ratio, NFR-04).
 *   2. The Map disappears on restart/redeploy, taking the stale-if-error fallback data with it (FR-10).
 *   3. Expiry is enforced lazily by this code; nothing bounds memory if keys keep growing.
 */

interface Item<T> {
  value: T;
  cachedAtMs: number;
  freshUntilMs: number;
  retainUntilMs: number;
}

export class MapToolCache<T> {
  private readonly entries = new Map<string, Item<T>>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Stores a value fresh for `ttlSeconds` and retained for 3 × TTL as stale fallback. */
  public set(key: string, value: T, ttlSeconds: number): void {
    const nowMs = this.now();
    this.entries.set(key, {
      value,
      cachedAtMs: nowMs,
      freshUntilMs: nowMs + ttlSeconds * 1000,
      retainUntilMs: nowMs + 3 * ttlSeconds * 1000,
    });
  }

  /** Returns the value with its freshness, or null when it is no longer retained. */
  public get(key: string): { value: T; isStale: boolean; cachedAt: string } | null {
    const item = this.entries.get(key);
    if (item === undefined) {
      return null;
    }
    const nowMs = this.now();
    if (nowMs >= item.retainUntilMs) {
      this.entries.delete(key); // lazy expiry: only happens when the key is read again
      return null;
    }
    return { value: item.value, isStale: nowMs >= item.freshUntilMs, cachedAt: new Date(item.cachedAtMs).toISOString() };
  }
}

// Usage inside one MCP server process:
//   const cache = new MapToolCache<CafeteriaDailyMenu>();
//   cache.set('cache:dining:2026-11-16', menu, 3600);
//   cache.get('cache:dining:2026-11-16'); // hit only in THIS process
