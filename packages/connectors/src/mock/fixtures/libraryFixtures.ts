/**
 * Synthetic library floors (FR-05). Floor IDs, names and capacities are kept identical to the
 * temporary MCP-server sample handler so that the dashboard does not change when the connector
 * replaces that sample. No real occupancy feed exists (Project Definition §4.3): data is always simulated.
 */

import type { LibraryFloor } from '@campus-orchestrator/shared';

export interface LibraryFloorFixture {
  floorId: Exclude<LibraryFloor, 'ALL'>;
  name: string;
  maxSeats: number;
  isQuietArea: boolean;
}

export const LIBRARY_FLOORS: readonly LibraryFloorFixture[] = [
  { floorId: 'FLOOR_1', name: 'Zemin Kat - Genel Çalışma & Danışma', maxSeats: 100, isQuietArea: false },
  { floorId: 'FLOOR_2', name: '1. Kat - Bireysel Çalışma & Kitaplık', maxSeats: 120, isQuietArea: false },
  { floorId: 'FLOOR_3', name: '2. Kat - Sessiz Çalışma Salonu', maxSeats: 80, isQuietArea: true },
];

/** Simulated opening hours (local time). Outside these hours occupancy is 0. */
export const LIBRARY_OPEN_HOUR = 8;
export const LIBRARY_CLOSE_HOUR = 24;

/** Occupancy is re-sampled every 15 minutes; within a bucket the value is stable. */
export const OCCUPANCY_BUCKET_MINUTES = 15;

/**
 * Base occupancy ratio per local hour on weekdays (index = hour). Weekend values are scaled by 0.55.
 * Shape: quiet mornings, peak in the early afternoon, second smaller peak in the evening.
 */
export const WEEKDAY_OCCUPANCY_CURVE: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, // 00–07 closed
  0.2, 0.3, 0.45, 0.55, 0.65, 0.8, 0.85, 0.85, // 08–15
  0.8, 0.7, 0.6, 0.6, 0.55, 0.45, 0.3, 0.15, // 16–23
];

export const WEEKEND_OCCUPANCY_FACTOR = 0.55;
