/**
 * Integration of the connector handlers with the MCP server's real ToolDispatcher (apps/mcp-server).
 * Proves that the connector tier can replace the temporary sample handlers without changing the
 * dispatcher: schema validation, auth guard and envelope pass-through all keep working.
 */

import { describe, expect, it } from 'vitest';
import { TOOL_NAMES, type AuthContext } from '@campus-orchestrator/shared';
import { AuthenticationRequiredError, ToolDispatcher } from '../../apps/mcp-server/src/index.js';
import {
  createCampusConnectors,
  createConnectorRuntime,
  FaultInjectingConnector,
  InMemoryCacheStore,
  loadConnectorConfig,
  registerConnectorHandlers,
  ResilientConnectorExecutor,
  type CafeteriaConnector,
} from '../../packages/connectors/src/index.js';
import { MONDAY, SATURDAY, TestClock } from './helpers.js';

const student: AuthContext = { studentId: '241101065', role: 'STUDENT' };
const guest: AuthContext = { role: 'GUEST' };

function wire(env: Record<string, string> = {}) {
  const clock = new TestClock(`${MONDAY}T12:35`);
  const runtime = createConnectorRuntime({ env, clock: clock.now });
  const dispatcher = new ToolDispatcher();
  registerConnectorHandlers(dispatcher, runtime);
  return { clock, runtime, dispatcher };
}

function jsonData(result: { content: unknown }): any {
  return (result.content as Array<{ data: unknown }>)[0]!.data;
}

describe('Connector handlers registered in the real ToolDispatcher', () => {
  it('registers all four tools', () => {
    const { dispatcher } = wire();
    for (const name of Object.values(TOOL_NAMES)) {
      expect(dispatcher.hasHandler(name)).toBe(true);
    }
  });

  it('UC-01: get_cafeteria_menu returns a weekday menu, then a cache hit', async () => {
    const { dispatcher } = wire();
    const first = await dispatcher.dispatch(TOOL_NAMES.CAFETERIA_MENU, { date: MONDAY }, guest);
    expect(first.isError).toBe(false);
    expect(first.isStale).toBe(false);
    expect(jsonData(first)).toMatchObject({ date: MONDAY, available: true });
    const second = await dispatcher.dispatch(TOOL_NAMES.CAFETERIA_MENU, {}, guest); // today == MONDAY
    expect((second as any).source).toBe('CACHE_HIT');
    expect(jsonData(second)).toEqual(jsonData(first));
  });

  it('marks every successful mock answer as simulated (Project Definition §4.3)', async () => {
    const { dispatcher } = wire();
    const calls: Array<[string, unknown, AuthContext]> = [
      [TOOL_NAMES.CAFETERIA_MENU, { date: MONDAY }, guest],
      [TOOL_NAMES.SHUTTLE_SCHEDULE, {}, guest],
      [TOOL_NAMES.LIBRARY_OCCUPANCY, {}, guest],
      [TOOL_NAMES.COURSE_SCHEDULE, { day: 'TUESDAY' }, student],
    ];
    for (const [name, args, auth] of calls) {
      const result = await dispatcher.dispatch(name, args, auth);
      expect(result.isError).toBe(false);
      expect((result as any).isSimulated).toBe(true);
      expect((result.content as any[])[0].isSimulated).toBe(true);
    }
  });

  it('UC-01: weekend menu is a normal answer with available=false', async () => {
    const { dispatcher } = wire();
    const result = await dispatcher.dispatch(TOOL_NAMES.CAFETERIA_MENU, { date: SATURDAY }, guest);
    expect(result.isError).toBe(false);
    expect(jsonData(result)).toMatchObject({ available: false, lunch: null, dinner: null });
  });

  it('UC-02: get_shuttle_schedule returns only future departures, also when served from cache', async () => {
    const { dispatcher, clock } = wire();
    const live = await dispatcher.dispatch(TOOL_NAMES.SHUTTLE_SCHEDULE, { route: 'MAIN_RING' }, guest);
    expect(jsonData(live).nextDepartures).toEqual(['12:45', '13:00', '13:15']);
    clock.at(`${MONDAY}T12:36`); // 60 s later, inside the 120 s TTL
    const cached = await dispatcher.dispatch(TOOL_NAMES.SHUTTLE_SCHEDULE, { route: 'MAIN_RING' }, guest);
    expect((cached as any).source).toBe('CACHE_HIT');
    expect(jsonData(cached).nextDepartures).toEqual(['12:45', '13:00', '13:15']);
  });

  it('UC-02: cached departures that have passed are removed before returning', async () => {
    const { dispatcher, clock } = wire();
    clock.at(`${MONDAY}T12:44`);
    await dispatcher.dispatch(TOOL_NAMES.SHUTTLE_SCHEDULE, { route: 'MAIN_RING' }, guest); // 12:45,13:00,13:15
    clock.at(`${MONDAY}T12:45`); // 60 s later, inside TTL; 12:45 is no longer strictly in the future
    const cached = await dispatcher.dispatch(TOOL_NAMES.SHUTTLE_SCHEDULE, { route: 'MAIN_RING' }, guest);
    expect((cached as any).source).toBe('CACHE_HIT');
    expect(jsonData(cached).nextDepartures).toEqual(['13:00', '13:15']);
  });

  it('UC-02: an invalid route is rejected by the dispatcher schema with -32602 before any connector call', async () => {
    const { dispatcher } = wire();
    const result = await dispatcher.dispatch(TOOL_NAMES.SHUTTLE_SCHEDULE, { route: 'NIGHT' }, guest);
    expect(result).toMatchObject({ isError: true, code: -32602 });
  });

  it('UC-03: get_library_occupancy is simulated and consistent', async () => {
    const { dispatcher } = wire();
    const result = await dispatcher.dispatch(TOOL_NAMES.LIBRARY_OCCUPANCY, { floor: 'ALL' }, guest);
    const report = jsonData(result);
    expect(report.isSimulated).toBe(true);
    expect(report.totalOccupied).toBe(report.floors.reduce((s: number, f: any) => s + f.occupiedSeats, 0));
  });

  it('UC-04: get_course_schedule uses only the verified identity; guests are refused by the dispatcher', async () => {
    const { dispatcher } = wire();
    await expect(dispatcher.dispatch(TOOL_NAMES.COURSE_SCHEDULE, { day: 'TUESDAY' }, guest)).rejects.toBeInstanceOf(
      AuthenticationRequiredError
    );
    const spoof = await dispatcher.dispatch(
      TOOL_NAMES.COURSE_SCHEDULE,
      { day: 'TUESDAY', studentId: '241101013' },
      student
    );
    expect(spoof).toMatchObject({ isError: true, code: -32602 }); // strict schema rejects studentId argument
    const result = await dispatcher.dispatch(TOOL_NAMES.COURSE_SCHEDULE, { day: 'TUESDAY' }, student);
    expect(result.isError).toBe(false);
    const classes = jsonData(result);
    expect(classes[0]).toMatchObject({ courseCode: 'BIL 481', startTime: '08:30', endTime: '10:20' });
  });

  it('an unknown day name becomes a structured -32602 error, not an internal error', async () => {
    const { dispatcher } = wire();
    const result = await dispatcher.dispatch(TOOL_NAMES.COURSE_SCHEDULE, { day: 'FUNDAY' }, student);
    expect(result).toMatchObject({ isError: true, code: -32602 });
  });

  it('an impossible date becomes a structured -32602 error', async () => {
    const { dispatcher } = wire();
    const result = await dispatcher.dispatch(TOOL_NAMES.CAFETERIA_MENU, { date: '2026-02-30' }, guest);
    expect(result).toMatchObject({ isError: true, code: -32602 });
  });

  it('FR-10 through the dispatcher: upstream failure after expiry → isStale=true with original timestamp', async () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    const config = loadConnectorConfig({});
    const connectors = createCampusConnectors(config, clock.now);
    const faulty = new FaultInjectingConnector(connectors.cafeteria) as unknown as CafeteriaConnector &
      FaultInjectingConnector<unknown, unknown>;
    const executor = new ResilientConnectorExecutor({ cache: new InMemoryCacheStore(clock.now), clock: clock.now });
    const dispatcher = new ToolDispatcher();
    registerConnectorHandlers(dispatcher, {
      connectors: { ...connectors, cafeteria: faulty },
      executor,
      ttlSeconds: config.ttlSeconds,
      clock: clock.now,
    });

    const fresh = await dispatcher.dispatch(TOOL_NAMES.CAFETERIA_MENU, { date: MONDAY }, guest);
    clock.advanceSeconds(3700);
    faulty.failNext(1);
    const stale = await dispatcher.dispatch(TOOL_NAMES.CAFETERIA_MENU, { date: MONDAY }, guest);
    expect(stale).toMatchObject({ isError: false, isStale: true, timestamp: fresh.timestamp });
    expect((stale.content as any[])[0]).toMatchObject({ type: 'json', isStale: true, timestamp: fresh.timestamp });

    // Empty cache + failure → structured error envelope (not a crash, not -32603)
    faulty.failNext(1);
    const noCache = await dispatcher.dispatch(TOOL_NAMES.CAFETERIA_MENU, { date: '2026-11-17' }, guest);
    expect(noCache).toMatchObject({ isError: true, code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('live mode without confirmed access degrades gracefully instead of crashing', async () => {
    const { dispatcher } = wire({ LIBRARY_CONNECTOR_MODE: 'live' });
    const result = await dispatcher.dispatch(TOOL_NAMES.LIBRARY_OCCUPANCY, {}, guest);
    expect(result).toMatchObject({ isError: true, code: 'UPSTREAM_UNAVAILABLE' });
  });
});
