import { describe, expect, it } from 'vitest';
import {
  cafeteriaCacheKey,
  courseScheduleCacheKey,
  hashStudentId,
  InMemoryCacheStore,
  libraryCacheKey,
  RedisCacheStore,
  shuttleCacheKey,
  type CacheEntry,
  type RedisLikeClient,
} from '../../packages/connectors/src/index.js';
import { MONDAY, TestClock } from './helpers.js';

/** Minimal fake of the node-redis client honouring PX expiry against a test clock. */
class FakeRedisClient implements RedisLikeClient {
  public readonly store = new Map<string, { value: string; expiresAtMs: number }>();
  public lastSetOptions: { PX: number } | null = null;

  constructor(private readonly clock: TestClock) {}

  public async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item || this.clock.now().getTime() >= item.expiresAtMs) {
      return null;
    }
    return item.value;
  }

  public async set(key: string, value: string, options: { PX: number }): Promise<unknown> {
    this.lastSetOptions = options;
    this.store.set(key, { value, expiresAtMs: this.clock.now().getTime() + options.PX });
    return 'OK';
  }

  public async del(key: string): Promise<unknown> {
    return this.store.delete(key) ? 1 : 0;
  }
}

const entry: CacheEntry<{ menu: string }> = {
  value: { menu: 'Mercimek' },
  cachedAt: '2026-11-16T09:00:00.000Z',
  freshUntil: '2026-11-16T10:00:00.000Z',
};

describe('Cache keys (FR-03, FR-09)', () => {
  it('follows cache:<namespace>:<params>, matching cache:dining:<date> from FR-03', () => {
    expect(cafeteriaCacheKey(MONDAY)).toBe('cache:dining:2026-11-16');
    expect(shuttleCacheKey('MAIN_RING')).toBe('cache:shuttle:MAIN_RING');
    expect(libraryCacheKey('ALL')).toBe('cache:library:ALL');
  });

  it('isolates course schedules per student without exposing the raw student ID', () => {
    const a = courseScheduleCacheKey('241101065', 'MONDAY');
    const b = courseScheduleCacheKey('241101013', 'MONDAY');
    expect(a).not.toBe(b);
    expect(a).not.toContain('241101065');
    expect(a).toBe(`cache:schedule:${hashStudentId('241101065')}:MONDAY`);
    expect(hashStudentId('241101065')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('InMemoryCacheStore', () => {
  it('returns stored entries until physical retention ends', async () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    const store = new InMemoryCacheStore(clock.now);
    await store.set('k', entry, 180);
    expect(await store.get('k')).toEqual(entry);
    clock.advanceSeconds(179);
    expect(await store.get('k')).toEqual(entry);
    clock.advanceSeconds(1);
    expect(await store.get('k')).toBeNull();
    expect(store.size()).toBe(0);
  });

  it('isolates callers from mutations of cached objects (serialisation boundary)', async () => {
    const store = new InMemoryCacheStore();
    await store.set('k', entry, 60);
    const read = await store.get<{ menu: string }>('k');
    read!.value.menu = 'changed';
    expect((await store.get<{ menu: string }>('k'))!.value.menu).toBe('Mercimek');
  });

  it('deletes keys', async () => {
    const store = new InMemoryCacheStore();
    await store.set('k', entry, 60);
    await store.delete('k');
    expect(await store.get('k')).toBeNull();
  });
});

describe('RedisCacheStore adapter (tested with a fake client, not a live Redis server)', () => {
  it('writes JSON with PX = retention in milliseconds and reads it back', async () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    const client = new FakeRedisClient(clock);
    const store = new RedisCacheStore(client);
    await store.set('cache:dining:2026-11-16', entry, 3 * 3600);
    expect(client.lastSetOptions).toEqual({ PX: 3 * 3600 * 1000 });
    expect(JSON.parse(client.store.get('cache:dining:2026-11-16')!.value)).toEqual(entry);
    expect(await store.get('cache:dining:2026-11-16')).toEqual(entry);
    clock.advanceSeconds(3 * 3600);
    expect(await store.get('cache:dining:2026-11-16')).toBeNull();
  });

  it('treats a corrupted value as a cache miss', async () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    const client = new FakeRedisClient(clock);
    await client.set('bad', '{not json', { PX: 1000 });
    expect(await new RedisCacheStore(client).get('bad')).toBeNull();
  });

  it('deletes keys through DEL', async () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    const client = new FakeRedisClient(clock);
    const store = new RedisCacheStore(client);
    await store.set('k', entry, 60);
    await store.delete('k');
    expect(client.store.has('k')).toBe(false);
  });
});
