import { describe, expect, it } from 'vitest';
import { createGatewayClient, QUERY_PATH, type Transport } from '../src/lib/gateway/client';
import { createFixtureTransport, type FixtureScenario } from '../src/lib/gateway/fixtureTransport';

/**
 * Y-03: gateway client against API Contract v1.1 §3.2 / §3.4.
 * The fixture transport returns real `Response` objects, so these tests run
 * the same parsing code the browser uses against the real gateway.
 */

// Monday 23 November 2026, 09:00 in Türkiye (UTC+3).
const MONDAY_0900 = () => new Date('2026-11-23T06:00:00.000Z');

function fixtureClient(scenario: FixtureScenario = 'normal', now = MONDAY_0900) {
  return createGatewayClient({ transport: createFixtureTransport({ scenario, now, latencyMs: 0 }) });
}

function jsonTransport(status: number, body: unknown, headers: Record<string, string> = {}): Transport {
  return async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

describe('gateway client — success responses', () => {
  it('returns the cafeteria domain object and its metadata (UC-01)', async () => {
    const result = await fixtureClient().query('get_cafeteria_menu', {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.date).toBe('2026-11-23');
    expect(result.data.available).toBe(true);
    expect(result.data.lunch?.calories).toBeGreaterThan(0);
    expect(result.data.dinner?.mainDish).toBeTruthy();
    expect(result.meta).toMatchObject({ isSimulated: true, isStale: false, source: 'LIVE' });
  });

  it('reports a weekend day as unavailable with a reason, not as an error', async () => {
    const result = await fixtureClient().query('get_cafeteria_menu', { date: '2026-11-22' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ available: false, lunch: null, dinner: null });
    expect(result.data.unavailableReason).toMatch(/hafta sonu/i);
  });

  it('returns only strictly future shuttle departures in ascending order (UC-02)', async () => {
    const result = await fixtureClient().query('get_shuttle_schedule', { route: 'MAIN_RING' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.routeId).toBe('MAIN_RING');
    expect(result.data.nextDepartures).toEqual(['09:15', '09:30', '09:45']);
  });

  it('returns an empty departure list after the last shuttle of the day', async () => {
    const lateNight = () => new Date('2026-11-23T20:30:00.000Z'); // 23:30 in Türkiye
    const result = await fixtureClient('normal', lateNight).query('get_shuttle_schedule', { route: 'DORMITORY_LINE' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nextDepartures).toEqual([]);
    expect(result.data.activeVehicles).toBe(0);
  });

  it('keeps library totals equal to the sum of the returned floors (UC-03)', async () => {
    const all = await fixtureClient().query('get_library_occupancy', { floor: 'ALL' });
    const single = await fixtureClient().query('get_library_occupancy', { floor: 'FLOOR_3' });

    expect(all.ok && single.ok).toBe(true);
    if (!all.ok || !single.ok) return;
    expect(all.data.floors).toHaveLength(3);
    expect(all.data.totalOccupied).toBe(all.data.floors.reduce((sum, floor) => sum + floor.occupiedSeats, 0));
    expect(all.data.totalCapacity).toBe(300);
    expect(single.data.floors.map((floor) => floor.floorId)).toEqual(['FLOOR_3']);
    expect(single.data.totalCapacity).toBe(80);
    for (const floor of all.data.floors) {
      expect(floor.occupiedSeats).toBeGreaterThanOrEqual(0);
      expect(floor.occupiedSeats).toBeLessThanOrEqual(floor.maxSeats);
    }
    // The same floor must show the same numbers alone and inside ALL (AT-03 step 3).
    expect(single.data.floors[0]).toEqual(all.data.floors.find((floor) => floor.floorId === 'FLOOR_3'));
  });

  it('preserves stale metadata and the original cache timestamp', async () => {
    const result = await fixtureClient('stale').query('get_library_occupancy', {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.source).toBe('STALE');
    expect(result.meta.isStale).toBe(true);
    expect(new Date(result.meta.timestamp).getTime()).toBeLessThan(MONDAY_0900().getTime());
  });
});

describe('gateway client — error responses', () => {
  it('maps an invalid route to INVALID_PARAMS with HTTP 400 (UC-02)', async () => {
    const result = await fixtureClient().query('get_shuttle_schedule', { route: 'NOWHERE' as never });

    expect(result).toMatchObject({ ok: false, code: 'INVALID_PARAMS', status: 400 });
  });

  it('maps an impossible date to INVALID_PARAMS (UC-01)', async () => {
    const result = await fixtureClient().query('get_cafeteria_menu', { date: '2026-99-77' });

    expect(result).toMatchObject({ ok: false, code: 'INVALID_PARAMS', status: 400 });
  });

  it('requires a token for the course schedule and returns 401 for a guest (UC-04)', async () => {
    const guest = await fixtureClient().query('get_course_schedule', {});
    const student = await fixtureClient().query('get_course_schedule', {}, { token: 'synthetic-test-token' });

    expect(guest).toMatchObject({ ok: false, code: 'AUTHENTICATION_REQUIRED', status: 401 });
    expect(student.ok).toBe(true);
  });

  it('reads Retry-After on HTTP 429', async () => {
    const result = await fixtureClient('rate-limited').query('get_cafeteria_menu', {});

    expect(result).toMatchObject({ ok: false, code: 'RATE_LIMITED', status: 429, retryAfterSeconds: 30 });
  });

  it('reports 503 upstream failures without inventing data', async () => {
    const result = await fixtureClient('upstream-unavailable').query('get_cafeteria_menu', {});

    expect(result).toMatchObject({ ok: false, code: 'UPSTREAM_UNAVAILABLE', status: 503 });
    expect(result).not.toHaveProperty('data');
  });

  it('returns NETWORK_ERROR when the request cannot be sent', async () => {
    const result = await fixtureClient('network-error').query('get_cafeteria_menu', {});

    expect(result).toMatchObject({ ok: false, code: 'NETWORK_ERROR' });
  });

  it('treats a non-JSON 5xx (gateway behind the rewrite is down) as NETWORK_ERROR', async () => {
    const client = createGatewayClient({
      transport: async () => new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } }),
    });

    expect(await client.query('get_cafeteria_menu', {})).toMatchObject({ ok: false, code: 'NETWORK_ERROR', status: 500 });
  });

  it('returns CLIENT_TIMEOUT when the gateway does not answer in time', async () => {
    const hanging: Transport = (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    const client = createGatewayClient({ transport: hanging, timeoutMs: 20 });

    expect(await client.query('get_cafeteria_menu', {})).toMatchObject({ ok: false, code: 'CLIENT_TIMEOUT' });
  });

  it('treats `{ ok: true, data: {} }` as an invalid response, not as success', async () => {
    const client = createGatewayClient({
      transport: jsonTransport(200, {
        ok: true,
        toolName: 'get_cafeteria_menu',
        data: {},
        meta: { isSimulated: true, isStale: false, source: 'LIVE', timestamp: '2026-11-23T06:00:00.000Z' },
      }),
    });

    expect(await client.query('get_cafeteria_menu', {})).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
  });

  it('rejects a source value outside LIVE | CACHE_HIT | STALE | ERROR (e.g. "MOCK")', async () => {
    const client = createGatewayClient({
      transport: jsonTransport(200, {
        ok: true,
        toolName: 'get_shuttle_schedule',
        data: { routeId: 'MAIN_RING', routeName: 'x', nextDepartures: [], activeVehicles: 0, lastUpdated: 'x' },
        meta: { isSimulated: true, isStale: false, source: 'MOCK', timestamp: '2026-11-23T06:00:00.000Z' },
      }),
    });

    expect(await client.query('get_shuttle_schedule', {})).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
  });
});

describe('gateway client — request shape and identity boundary', () => {
  it('posts { toolName, parameters } to /api/v1/query and sends Authorization only with a token', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const recorder: Transport = async (url, init) => {
      seen.push({ url, init });
      return createFixtureTransport({ now: MONDAY_0900, latencyMs: 0 })(url, init);
    };
    const client = createGatewayClient({ transport: recorder });

    await client.query('get_shuttle_schedule', { route: 'METRO_LINE' });
    await client.query('get_course_schedule', {}, { token: 'synthetic-test-token' });

    expect(seen[0]?.url).toBe(QUERY_PATH);
    expect(JSON.parse(String(seen[0]?.init.body))).toEqual({ toolName: 'get_shuttle_schedule', parameters: { route: 'METRO_LINE' } });
    expect(new Headers(seen[0]?.init.headers).has('Authorization')).toBe(false);
    expect(new Headers(seen[1]?.init.headers).get('Authorization')).toBe('Bearer synthetic-test-token');
  });

  it('refuses to send a studentId parameter, even with a valid token', async () => {
    const client = fixtureClient();

    await expect(
      client.query('get_course_schedule', { studentId: 'someone-else' } as never, { token: 'synthetic-test-token' })
    ).rejects.toThrow(/studentId/);
  });
});
