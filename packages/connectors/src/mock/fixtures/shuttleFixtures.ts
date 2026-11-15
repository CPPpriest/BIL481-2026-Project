/**
 * Synthetic shuttle ("ring") timetables (FR-04). Times are Türkiye local time.
 * The real campus timetable is not available (Project Definition §4.3), so these
 * timetables are representative fixtures, not official data.
 */

import type { ShuttleRoute } from '@campus-orchestrator/shared';

export interface TimetableFixture {
  /** First departure, HH:MM. */
  first: string;
  /** Last departure, HH:MM (inclusive when it falls on the interval). */
  last: string;
  /** Minutes between departures. */
  intervalMinutes: number;
}

export interface ShuttleRouteFixture {
  routeId: ShuttleRoute;
  routeName: string;
  weekday: TimetableFixture;
  weekend: TimetableFixture;
  /** Vehicles in service at peak time. */
  peakVehicles: number;
}

export const SHUTTLE_ROUTES: Readonly<Record<ShuttleRoute, ShuttleRouteFixture>> = {
  MAIN_RING: {
    routeId: 'MAIN_RING',
    routeName: 'Ana Ring Hattı (Kampüs – Metro – Yurtlar)',
    weekday: { first: '07:30', last: '22:00', intervalMinutes: 15 },
    weekend: { first: '09:00', last: '21:00', intervalMinutes: 30 },
    peakVehicles: 4,
  },
  METRO_LINE: {
    routeId: 'METRO_LINE',
    routeName: 'Metro Bağlantı Hattı (Kampüs – Metro Durağı)',
    weekday: { first: '07:00', last: '23:00', intervalMinutes: 20 },
    weekend: { first: '08:00', last: '22:00', intervalMinutes: 40 },
    peakVehicles: 3,
  },
  DORMITORY_LINE: {
    routeId: 'DORMITORY_LINE',
    routeName: 'Yurtlar Servisi (Ana Kampüs – Yurtlar)',
    weekday: { first: '07:15', last: '21:45', intervalMinutes: 30 },
    weekend: { first: '10:00', last: '20:00', intervalMinutes: 60 },
    peakVehicles: 2,
  },
};

/** Number of upcoming departures returned per request (FR-04 acceptance: "next three"). */
export const NEXT_DEPARTURE_COUNT = 3;
