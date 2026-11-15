import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cafeteriaCacheKey,
  ConnectorInputError,
  FaultInjectingConnector,
  InMemoryCacheStore,
  libraryCacheKey,
  MockCafeteriaConnector,
  MockLibraryConnector,
  MockShuttleConnector,
  ResilientConnectorExecutor,
  shuttleCacheKey,
  type CacheStore,
} from '../../packages/connectors/src/index.js';
import { MONDAY, SEED, TestClock } from './helpers.js';

function setup(timeoutMs?: number) {
  const clock = new TestClock(`${MONDAY}T12:00`);
  const cache = new InMemoryCacheStore(clock.now);
  const executor = new ResilientConnectorExecutor({ cache, clock: clock.now, timeoutMs });
  const cafeteria = new FaultInjectingConnector(new MockCafeteriaConnector(SEED, clock.now));
  const library = new FaultInjectingConnector(new MockLibraryConnector(SEED, clock.now));
  const shuttle = new FaultInjectingConnector(new MockShuttleConnector(SEED, clock.now));
  const callCafeteria = () =>
    executor.execute({
      connectorName: 'cafeteria',
      connector: cafeteria,
      input: { date: MONDAY },
      cacheKey: cafeteriaCacheKey(MONDAY),
      ttlSeconds: 3600,
    });
  const callLibrary = () =>
    executor.execute({
      connectorName: 'library',
      connector: library,
      input: { floor: 'ALL' as const },
      cacheKey: libraryCacheKey('ALL'),
      ttlSeconds: 60,
    });
  const callShuttle = () =>
    executor.execute({
      connectorName: 'shuttle',
      connector: shuttle,
      input: { route: 'MAIN_RING' as const },
      cacheKey: shuttleCacheKey('MAIN_RING'),
      ttlSeconds: 120,
    });
  return { clock, cache, executor, cafeteria, library, shuttle, callCafeteria, callLibrary, callShuttle };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('FR-09: TTL caching', () => {
  it('first call is LIVE, repeated calls within the TTL are CACHE_HIT without upstream calls', async () => {
    const { cafeteria, callCafeteria, clock } = setup();
    const first = await callCafeteria();
    expect(first).toMatchObject({ source: 'LIVE', isStale: false });
    expect(first.timestamp).toBe(clock.now().toISOString());
    clock.advanceSeconds(3599);
    const second = await callCafeteria();
    expect(second).toMatchObject({ source: 'CACHE_HIT', isStale: false, timestamp: first.timestamp });
    expect(second.data).toEqual(first.data);
    expect(cafeteria.upstreamCalls).toBe(1);
  });

  it('calls the connector again once the TTL has passed', async () => {
    const { cafeteria, callCafeteria, clock } = setup();
    await callCafeteria();
    clock.advanceSeconds(3600);
    expect((await callCafeteria()).source).toBe('LIVE');
    expect(cafeteria.upstreamCalls).toBe(2);
  });

  it('keeps the value physically for 3 × TTL (retention for stale fallback)', async () => {
    const { cache, callLibrary, clock } = setup();
    await callLibrary(); // TTL 60 s → retained 180 s
    clock.advanceSeconds(179);
    expect(await cache.get(libraryCacheKey('ALL'))).not.toBeNull();
    clock.advanceSeconds(1);
    expect(await cache.get(libraryCacheKey('ALL'))).toBeNull();
  });
});

describe('FR-10: stale-if-error fallback', () => {
  it('serves the expired cached value with isStale=true and the ORIGINAL timestamp (TC-06)', async () => {
    const { cafeteria, callCafeteria, clock } = setup();
    const fresh = await callCafeteria();
    clock.advanceSeconds(3600 + 120); // TTL expired, still inside 3 × TTL retention
    cafeteria.failNext(1);
    const stale = await callCafeteria();
    expect(stale).toMatchObject({ source: 'STALE', isStale: true, timestamp: fresh.timestamp });
    expect(stale.data).toEqual(fresh.data);
    expect(stale.failure).toEqual({
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'The campus service is currently unavailable. Please try again later.',
    });
  });

  it('returns a structured, user-readable ERROR when there is no cached value', async () => {
    const { cafeteria, callCafeteria } = setup();
    cafeteria.failNext(1);
    const result = await callCafeteria();
    expect(result).toMatchObject({ source: 'ERROR', data: null, isStale: false });
    expect(result.failure!.message).not.toMatch(/Injected|stack|Error:/);
  });

  it('treats an upstream call slower than 800 ms as a failure (default timeout)', async () => {
    vi.useFakeTimers();
    const { cafeteria, callCafeteria } = setup();
    cafeteria.failNext(1, 'hang');
    const pending = callCafeteria();
    await vi.advanceTimersByTimeAsync(799);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(result).toMatchObject({ source: 'ERROR', failure: { code: 'UPSTREAM_TIMEOUT' } });
  });

  it('serves stale data when the upstream hangs and a retained value exists', async () => {
    const { cafeteria, callCafeteria, clock } = setup(30);
    const fresh = await callCafeteria();
    clock.advanceSeconds(3700);
    cafeteria.failNext(1, 'hang');
    const result = await callCafeteria();
    expect(result).toMatchObject({ source: 'STALE', isStale: true, timestamp: fresh.timestamp });
    expect(result.failure!.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('a cache outage never fails a successful upstream call', async () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    const brokenCache: CacheStore = {
      get: async () => {
        throw new Error('redis down');
      },
      set: async () => {
        throw new Error('redis down');
      },
      delete: async () => undefined,
    };
    const executor = new ResilientConnectorExecutor({ cache: brokenCache, clock: clock.now });
    const result = await executor.execute({
      connectorName: 'cafeteria',
      connector: new MockCafeteriaConnector(SEED, clock.now),
      input: { date: MONDAY },
      cacheKey: cafeteriaCacheKey(MONDAY),
      ttlSeconds: 3600,
    });
    expect(result.source).toBe('LIVE');
  });
});

describe('FR-11: circuit breaking inside the executor', () => {
  it('after 3 failures the cafeteria makes ZERO upstream calls for 60 s, then probes once', async () => {
    const { cafeteria, callCafeteria, clock, executor } = setup();
    cafeteria.failAlways();
    for (let i = 0; i < 3; i += 1) {
      await callCafeteria();
    }
    expect(cafeteria.upstreamCalls).toBe(3);
    expect(executor.circuitSnapshot('cafeteria').state).toBe('OPEN');

    for (let i = 0; i < 10; i += 1) {
      const result = await callCafeteria();
      expect(result.failure!.code).toBe('CIRCUIT_OPEN');
      clock.advanceSeconds(5);
    }
    expect(cafeteria.upstreamCalls).toBe(3); // nothing reached the upstream during 50 s

    clock.advanceSeconds(10); // 60 s since opening
    cafeteria.recover();
    expect((await callCafeteria()).source).toBe('LIVE');
    expect(cafeteria.upstreamCalls).toBe(4);
    expect(executor.circuitSnapshot('cafeteria').state).toBe('CLOSED');
  });

  it('serves stale data while the circuit is open if a retained value exists', async () => {
    const { cafeteria, callCafeteria, clock } = setup();
    const fresh = await callCafeteria();
    clock.advanceSeconds(3600);
    cafeteria.failAlways();
    await callCafeteria();
    await callCafeteria();
    await callCafeteria(); // circuit opens
    const duringOpen = await callCafeteria();
    expect(duringOpen).toMatchObject({ source: 'STALE', isStale: true, timestamp: fresh.timestamp });
    expect(duringOpen.failure!.code).toBe('CIRCUIT_OPEN');
  });

  it('NFR-03 isolation: a broken cafeteria does not affect library or shuttle', async () => {
    const { cafeteria, library, shuttle, callCafeteria, callLibrary, callShuttle, executor, clock } = setup();
    cafeteria.failAlways();
    for (let i = 0; i < 5; i += 1) {
      await callCafeteria();
      expect((await callLibrary()).isStale).toBe(false);
      expect((await callShuttle()).isStale).toBe(false);
      clock.advanceSeconds(130); // past library and shuttle TTLs so they hit their connectors
    }
    expect(executor.circuitSnapshot('cafeteria').state).toBe('OPEN');
    expect(executor.circuitSnapshot('library').state).toBe('CLOSED');
    expect(executor.circuitSnapshot('shuttle').state).toBe('CLOSED');
    expect(library.upstreamCalls).toBe(5);
    expect(shuttle.upstreamCalls).toBe(5);
  });

  it('caller errors (invalid input) are re-thrown and never trip the circuit', async () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    const executor = new ResilientConnectorExecutor({ cache: new InMemoryCacheStore(clock.now), clock: clock.now });
    const call = () =>
      executor.execute({
        connectorName: 'cafeteria',
        connector: new MockCafeteriaConnector(SEED, clock.now),
        input: { date: '2026-02-30' },
        cacheKey: cafeteriaCacheKey('2026-02-30'),
        ttlSeconds: 3600,
      });
    for (let i = 0; i < 5; i += 1) {
      await expect(call()).rejects.toBeInstanceOf(ConnectorInputError);
    }
    expect(executor.circuitSnapshot('cafeteria')).toMatchObject({ state: 'CLOSED', consecutiveFailures: 0 });
  });
});
