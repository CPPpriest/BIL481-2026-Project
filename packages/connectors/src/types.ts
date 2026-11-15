/**
 * Connector-tier types for Campus Data Orchestrator (FR-03 – FR-06, FR-09 – FR-12).
 *
 * The base contract `ICampusConnector<TInput, TOutput>` and every domain model
 * (CafeteriaDailyMenu, ShuttleRouteData, LibraryOccupancyReport, StudentClassEntry)
 * are owned by `@campus-orchestrator/shared` and are NOT redefined here.
 * This file only adds connector-management metadata on top of that contract.
 */

import type {
  ICampusConnector,
  CafeteriaDailyMenu,
  ShuttleRouteData,
  LibraryOccupancyReport,
  StudentClassEntry,
  GetCafeteriaMenuInput,
  GetShuttleScheduleInput,
  GetLibraryOccupancyInput,
  GetCourseScheduleInput,
} from '@campus-orchestrator/shared';

/** Operating mode of a connector (FR-12). Selected per connector through environment variables. */
export type ConnectorMode = 'mock' | 'live';

/** Stable identifiers of the four campus connectors. Used for circuit breakers, cache keys and health reports. */
export type ConnectorName = 'cafeteria' | 'shuttle' | 'library' | 'courseSchedule';

export const CONNECTOR_NAMES: readonly ConnectorName[] = [
  'cafeteria',
  'shuttle',
  'library',
  'courseSchedule',
] as const;

/** Clock abstraction so that time-dependent behaviour (TTL, departures, circuit cooldown) is testable. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

/** Result of a connector health probe. Feeds the dashboard "service status" card (FR-18) in Phase 3. */
export interface ConnectorHealth {
  connector: ConnectorName;
  mode: ConnectorMode;
  status: 'UP' | 'DOWN';
  checkedAt: string;
  detail?: string;
}

/**
 * Managed connector = shared `ICampusConnector` + management metadata required by FR-12
 * (explicit mode and a health probe). `execute` keeps the exact shared signature.
 */
export interface ManagedCampusConnector<TInput = unknown, TOutput = unknown>
  extends ICampusConnector<TInput, TOutput> {
  readonly name: ConnectorName;
  readonly mode: ConnectorMode;
  readonly isMock: boolean;
  healthCheck(): Promise<ConnectorHealth>;
}

export type CafeteriaConnector = ManagedCampusConnector<GetCafeteriaMenuInput, CafeteriaDailyMenu>;
export type ShuttleConnector = ManagedCampusConnector<GetShuttleScheduleInput, ShuttleRouteData>;
export type LibraryConnector = ManagedCampusConnector<GetLibraryOccupancyInput, LibraryOccupancyReport>;
export type CourseScheduleConnector = ManagedCampusConnector<GetCourseScheduleInput, StudentClassEntry[]>;

/** The full set of connectors wired behind the four MCP tools. */
export interface CampusConnectorSet {
  cafeteria: CafeteriaConnector;
  shuttle: ShuttleConnector;
  library: LibraryConnector;
  courseSchedule: CourseScheduleConnector;
}
