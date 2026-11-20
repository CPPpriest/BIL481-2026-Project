/**
 * Browser-facing gateway types, exactly as defined in API Contract v1.1 §3.
 *
 * Domain payloads (`data`) reuse the shared types from packages/shared so the
 * web app never forks its own copy of the menu / shuttle / library models.
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

/** Tool name -> `parameters` type and `data` type (contract §2). */
export interface ToolContract {
  get_cafeteria_menu: { params: GetCafeteriaMenuInput; data: CafeteriaDailyMenu };
  get_shuttle_schedule: { params: GetShuttleScheduleInput; data: ShuttleRouteData };
  get_library_occupancy: { params: GetLibraryOccupancyInput; data: LibraryOccupancyReport };
  get_course_schedule: { params: GetCourseScheduleInput; data: StudentClassEntry[] };
}

export type ToolName = keyof ToolContract;
export type ToolParams<T extends ToolName> = ToolContract[T]['params'];
export type ToolData<T extends ToolName> = ToolContract[T]['data'];

/** Tools a guest may call; `get_course_schedule` needs a verified student (contract §2). */
export const PUBLIC_TOOLS = ['get_cafeteria_menu', 'get_shuttle_schedule', 'get_library_occupancy'] as const;

/**
 * Execution source of the data (contract §1 "Source metadata"). `LIVE` means a
 * fresh connector run — which may still be synthetic; simulation is reported
 * separately by `isSimulated`.
 */
export type DataSource = 'LIVE' | 'CACHE_HIT' | 'STALE' | 'ERROR';

export interface ResponseMeta {
  isSimulated: boolean;
  isStale: boolean;
  source: DataSource;
  /** ISO time the data was fetched; for stale data, the original cache time. */
  timestamp: string;
  durationMs?: number;
}

/** `POST /api/v1/query` request body (contract §3.2). No identity fields allowed. */
export interface QueryRequestBody<T extends ToolName = ToolName> {
  toolName: T;
  parameters: ToolParams<T>;
}

/** HTTP 200 body of `POST /api/v1/query` (contract §3.2). */
export interface QuerySuccessBody<T extends ToolName = ToolName> {
  ok: true;
  toolName: T;
  data: ToolData<T>;
  meta: ResponseMeta;
}

/** Error codes the gateway may return (contract §3.4). */
export type GatewayErrorCode =
  | 'INVALID_PARAMS'
  | 'AUTHENTICATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'DOWNSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'INTERNAL_ERROR';

/** Stable JSON error body (contract §3.4). */
export interface GatewayErrorBody {
  ok: false;
  error: { code: GatewayErrorCode; message: string };
  timestamp: string;
}

/**
 * Errors detected in the browser itself, before or instead of a gateway
 * answer. These are not part of the contract; they let the UI tell
 * "no connection" apart from a gateway-reported failure.
 */
export type ClientErrorCode = 'NETWORK_ERROR' | 'CLIENT_TIMEOUT' | 'INVALID_RESPONSE' | 'ABORTED';

export type QueryErrorCode = GatewayErrorCode | ClientErrorCode;

/** What the UI receives from `gatewayClient.query()`; expected failures are values, not exceptions. */
export type QueryResult<T extends ToolName> =
  | { ok: true; toolName: T; data: ToolData<T>; meta: ResponseMeta }
  | {
      ok: false;
      code: QueryErrorCode;
      /** Safe, user-readable message from the gateway, or a client-side description. */
      message: string;
      /** HTTP status when the gateway answered; undefined for client-side errors. */
      status?: number;
      /** Seconds from the `Retry-After` header on HTTP 429. */
      retryAfterSeconds?: number;
    };
