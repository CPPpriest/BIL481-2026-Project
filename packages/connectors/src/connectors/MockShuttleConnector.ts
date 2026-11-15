/**
 * Mock shuttle connector — backs the `get_shuttle_schedule` tool (FR-04, FR-12).
 *
 * Behaviour:
 * - `route` defaults to MAIN_RING; an unknown route → ConnectorInputError listing valid routes
 *   (the MCP schema already rejects it with -32602; this is a defensive second check).
 * - Departures are generated from the route's weekday/weekend timetable in Türkiye time.
 * - Only departures strictly later than the current instant are returned, sorted ascending,
 *   at most NEXT_DEPARTURE_COUNT (3). After the last departure of the day the list is empty
 *   and `activeVehicles` is 0.
 * - `activeVehicles` is deterministic per (seed, route, date, hour).
 */

import type { GetShuttleScheduleInput, ShuttleRoute, ShuttleRouteData } from '@campus-orchestrator/shared';
import { ConnectorInputError } from '../errors.js';
import { NEXT_DEPARTURE_COUNT, SHUTTLE_ROUTES, type TimetableFixture } from '../mock/fixtures/shuttleFixtures.js';
import { createSeededRandom } from '../mock/seededRandom.js';
import { isWeekend, minutesToTime, timeToSeconds, toTurkeyLocalTime } from '../mock/turkeyTime.js';
import { systemClock, type Clock, type ConnectorHealth, type ShuttleConnector } from '../types.js';

export const VALID_SHUTTLE_ROUTES = Object.keys(SHUTTLE_ROUTES) as ShuttleRoute[];

/** Expands a timetable fixture into a sorted list of "HH:MM" departures. */
export function expandTimetable(timetable: TimetableFixture): string[] {
  const first = timeToSeconds(timetable.first) / 60;
  const last = timeToSeconds(timetable.last) / 60;
  const departures: string[] = [];
  for (let minute = first; minute <= last; minute += timetable.intervalMinutes) {
    departures.push(minutesToTime(minute));
  }
  return departures;
}

export class MockShuttleConnector implements ShuttleConnector {
  public readonly name = 'shuttle' as const;
  public readonly mode = 'mock' as const;
  public readonly isMock = true;

  constructor(
    private readonly seed: string,
    private readonly clock: Clock = systemClock
  ) {}

  public async execute(input: GetShuttleScheduleInput): Promise<ShuttleRouteData> {
    const routeId = input.route ?? 'MAIN_RING';
    const route = SHUTTLE_ROUTES[routeId];
    if (route === undefined) {
      throw new ConnectorInputError(
        `Unknown shuttle route '${String(routeId)}'. Valid routes: ${VALID_SHUTTLE_ROUTES.join(', ')}`
      );
    }

    const now = this.clock();
    const local = toTurkeyLocalTime(now);
    const timetable = isWeekend(local.weekday) ? route.weekend : route.weekday;

    const nextDepartures = expandTimetable(timetable)
      .filter((departure) => timeToSeconds(departure) > local.secondsOfDay)
      .slice(0, NEXT_DEPARTURE_COUNT);

    let activeVehicles = 0;
    if (nextDepartures.length > 0) {
      const hour = Math.floor(local.secondsOfDay / 3600);
      const random = createSeededRandom(this.seed, 'shuttle', routeId, local.isoDate, hour);
      const peak = isWeekend(local.weekday) ? Math.max(1, route.peakVehicles - 1) : route.peakVehicles;
      activeVehicles = random.intBetween(1, peak);
    }

    return {
      routeId,
      routeName: route.routeName,
      nextDepartures,
      activeVehicles,
      lastUpdated: now.toISOString(),
    };
  }

  public async healthCheck(): Promise<ConnectorHealth> {
    return {
      connector: this.name,
      mode: this.mode,
      status: 'UP',
      checkedAt: this.clock().toISOString(),
      detail: 'Deterministic synthetic timetable (no upstream dependency)',
    };
  }
}
