/**
 * Builds the connector set from configuration (FR-12 hot-swappable modes).
 *
 *   mode = 'mock' → deterministic synthetic connector (seeded by CONNECTOR_MOCK_SEED)
 *   mode = 'live' → UnavailableLiveConnector placeholder (no confirmed upstream access yet)
 *
 * Changing `*_CONNECTOR_MODE` and restarting is enough to switch a connector; no code changes.
 */

import type {
  CafeteriaDailyMenu,
  GetCafeteriaMenuInput,
  GetCourseScheduleInput,
  GetLibraryOccupancyInput,
  GetShuttleScheduleInput,
  LibraryOccupancyReport,
  ShuttleRouteData,
  StudentClassEntry,
} from '@campus-orchestrator/shared';
import type { ConnectorRuntimeConfig } from './config.js';
import { MockCafeteriaConnector } from './connectors/MockCafeteriaConnector.js';
import { MockCourseScheduleConnector } from './connectors/MockCourseScheduleConnector.js';
import { MockLibraryConnector } from './connectors/MockLibraryConnector.js';
import { MockShuttleConnector } from './connectors/MockShuttleConnector.js';
import { UnavailableLiveConnector } from './connectors/UnavailableLiveConnector.js';
import { systemClock, type CampusConnectorSet, type Clock, type ConnectorHealth } from './types.js';

export function createCampusConnectors(
  config: Pick<ConnectorRuntimeConfig, 'modes' | 'mockSeed'>,
  clock: Clock = systemClock
): CampusConnectorSet {
  const seed = config.mockSeed;
  return {
    cafeteria:
      config.modes.cafeteria === 'mock'
        ? new MockCafeteriaConnector(seed, clock)
        : new UnavailableLiveConnector<GetCafeteriaMenuInput, CafeteriaDailyMenu>('cafeteria', clock),
    shuttle:
      config.modes.shuttle === 'mock'
        ? new MockShuttleConnector(seed, clock)
        : new UnavailableLiveConnector<GetShuttleScheduleInput, ShuttleRouteData>('shuttle', clock),
    library:
      config.modes.library === 'mock'
        ? new MockLibraryConnector(seed, clock)
        : new UnavailableLiveConnector<GetLibraryOccupancyInput, LibraryOccupancyReport>('library', clock),
    courseSchedule:
      config.modes.courseSchedule === 'mock'
        ? new MockCourseScheduleConnector(seed, clock)
        : new UnavailableLiveConnector<GetCourseScheduleInput, StudentClassEntry[]>('courseSchedule', clock),
  };
}

/** Runs all four health probes (input for the dashboard service-status card, FR-18). */
export async function checkConnectorHealth(connectors: CampusConnectorSet): Promise<ConnectorHealth[]> {
  return Promise.all([
    connectors.cafeteria.healthCheck(),
    connectors.shuttle.healthCheck(),
    connectors.library.healthCheck(),
    connectors.courseSchedule.healthCheck(),
  ]);
}
