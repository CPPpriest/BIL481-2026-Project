/**
 * Mock library connector — backs the `get_library_occupancy` tool (FR-05, FR-12).
 *
 * Behaviour:
 * - `floor` defaults to ALL; a single floor returns only that floor and its own totals.
 * - Occupancy follows a time-of-day curve (weekend scaled down) with deterministic ±8 % noise,
 *   re-sampled every 15 minutes in Türkiye time. Outside opening hours occupancy is 0.
 * - Guarantees: 0 ≤ occupiedSeats ≤ maxSeats; totalOccupied / totalCapacity are exact sums of the
 *   returned floors; `isSimulated` is always true because no real feed exists.
 */

import type {
  GetLibraryOccupancyInput,
  LibraryFloorOccupancy,
  LibraryOccupancyReport,
} from '@campus-orchestrator/shared';
import { ConnectorInputError } from '../errors.js';
import {
  LIBRARY_CLOSE_HOUR,
  LIBRARY_FLOORS,
  LIBRARY_OPEN_HOUR,
  OCCUPANCY_BUCKET_MINUTES,
  WEEKDAY_OCCUPANCY_CURVE,
  WEEKEND_OCCUPANCY_FACTOR,
} from '../mock/fixtures/libraryFixtures.js';
import { createSeededRandom } from '../mock/seededRandom.js';
import { isWeekend, toTurkeyLocalTime } from '../mock/turkeyTime.js';
import { systemClock, type Clock, type ConnectorHealth, type LibraryConnector } from '../types.js';

export const VALID_LIBRARY_FLOORS = ['FLOOR_1', 'FLOOR_2', 'FLOOR_3', 'ALL'] as const;

export class MockLibraryConnector implements LibraryConnector {
  public readonly name = 'library' as const;
  public readonly mode = 'mock' as const;
  public readonly isMock = true;

  constructor(
    private readonly seed: string,
    private readonly clock: Clock = systemClock
  ) {}

  public async execute(input: GetLibraryOccupancyInput): Promise<LibraryOccupancyReport> {
    const floorSelector = input.floor ?? 'ALL';
    if (!(VALID_LIBRARY_FLOORS as readonly string[]).includes(floorSelector)) {
      throw new ConnectorInputError(
        `Unknown library floor '${String(floorSelector)}'. Valid values: ${VALID_LIBRARY_FLOORS.join(', ')}`
      );
    }

    const now = this.clock();
    const local = toTurkeyLocalTime(now);
    const hour = Math.floor(local.secondsOfDay / 3600);
    const bucket = Math.floor(local.secondsOfDay / (OCCUPANCY_BUCKET_MINUTES * 60));
    const isOpen = hour >= LIBRARY_OPEN_HOUR && hour < LIBRARY_CLOSE_HOUR;
    const baseRatio =
      (WEEKDAY_OCCUPANCY_CURVE[hour] ?? 0) * (isWeekend(local.weekday) ? WEEKEND_OCCUPANCY_FACTOR : 1);

    const floors: LibraryFloorOccupancy[] = LIBRARY_FLOORS.filter(
      (floor) => floorSelector === 'ALL' || floor.floorId === floorSelector
    ).map((floor) => {
      let occupiedSeats = 0;
      if (isOpen) {
        const random = createSeededRandom(this.seed, 'library', floor.floorId, local.isoDate, bucket);
        const noise = (random.next() - 0.5) * 0.16; // ±8 %
        const quietBonus = floor.isQuietArea ? 0.05 : 0; // quiet floor fills slightly faster
        const ratio = Math.min(1, Math.max(0, baseRatio + noise + quietBonus));
        occupiedSeats = Math.round(ratio * floor.maxSeats);
      }
      return {
        floorId: floor.floorId,
        name: floor.name,
        occupiedSeats,
        maxSeats: floor.maxSeats,
        isQuietArea: floor.isQuietArea,
      };
    });

    return {
      timestamp: now.toISOString(),
      isSimulated: true,
      totalCapacity: floors.reduce((sum, floor) => sum + floor.maxSeats, 0),
      totalOccupied: floors.reduce((sum, floor) => sum + floor.occupiedSeats, 0),
      floors,
    };
  }

  public async healthCheck(): Promise<ConnectorHealth> {
    return {
      connector: this.name,
      mode: this.mode,
      status: 'UP',
      checkedAt: this.clock().toISOString(),
      detail: 'Simulated occupancy generator (no real library feed exists)',
    };
  }
}
