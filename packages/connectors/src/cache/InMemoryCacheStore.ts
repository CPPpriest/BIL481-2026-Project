/**
 * Process-local cache store backed by a Map (FR-09 contract, test/offline implementation).
 *
 * Limitations — why it is NOT the production store (see comparisons/Redis-vs-memory):
 * - Not shared between MCP server instances (breaks NFR-04 stateless scaling and NFR-02 hit ratio).
 * - Lost on restart, so stale fallback data disappears exactly when a redeploy happens.
 * Values are deep-copied on write and read so callers cannot mutate cached data, mirroring the
 * serialisation boundary of Redis.
 */

import { systemClock, type Clock } from '../types.js';
import type { CacheEntry, CacheStore } from './CacheStore.js';

interface StoredItem {
  serialized: string;
  expiresAtMs: number;
}

export class InMemoryCacheStore implements CacheStore {
  private readonly items = new Map<string, StoredItem>();

  constructor(private readonly clock: Clock = systemClock) {}

  public async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const item = this.items.get(key);
    if (item === undefined) {
      return null;
    }
    if (this.clock().getTime() >= item.expiresAtMs) {
      this.items.delete(key);
      return null;
    }
    return JSON.parse(item.serialized) as CacheEntry<T>;
  }

  public async set<T>(key: string, entry: CacheEntry<T>, retentionSeconds: number): Promise<void> {
    this.items.set(key, {
      serialized: JSON.stringify(entry),
      expiresAtMs: this.clock().getTime() + retentionSeconds * 1000,
    });
  }

  public async delete(key: string): Promise<void> {
    this.items.delete(key);
  }

  /** Number of physically retained keys (diagnostics/tests). */
  public size(): number {
    return this.items.size;
  }
}
