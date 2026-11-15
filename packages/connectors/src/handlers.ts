/**
 * MCP tool handlers backed by connectors + resilience pipeline.
 *
 * These handlers have the exact `ToolHandler` shape used by the MCP server's ToolDispatcher
 * (`(args, auth) => Promise<...>`) and return an MCPToolResponse-compatible envelope, which the
 * dispatcher passes through unchanged. They are the drop-in replacement for the temporary
 * `sampleMockHandlers` in apps/mcp-server (integration owned by Murat — see the handoff note).
 *
 * Responsibilities kept here (and NOT in the dispatcher):
 * - resolve defaults to effective values (date → today in TR time, route → MAIN_RING, floor → ALL, day → weekday)
 * - build cache keys (student ID hashed)
 * - call the ResilientConnectorExecutor (TTL cache, stale-if-error, circuit breaker)
 * - for shuttle results served from cache, drop departures that have already passed (FR-04)
 * - map caller errors to structured envelopes (-32602 for invalid input) instead of internal errors
 * - mark data produced by a mock connector with `isSimulated: true`, so synthetic data is never presented
 *   as real campus data (Project Definition §4.3)
 */

import {
  TOOL_NAMES,
  type AuthContext,
  type CafeteriaDailyMenu,
  type GetCafeteriaMenuInput,
  type GetCourseScheduleInput,
  type GetLibraryOccupancyInput,
  type GetShuttleScheduleInput,
  type LibraryOccupancyReport,
  type MCPToolResponse,
  type ShuttleRouteData,
  type StudentClassEntry,
  type ToolName,
} from '@campus-orchestrator/shared';
import {
  cafeteriaCacheKey,
  courseScheduleCacheKey,
  libraryCacheKey,
  shuttleCacheKey,
} from './cache/cacheKeys.js';
import { resolveScheduleDay } from './connectors/MockCourseScheduleConnector.js';
import { ConnectorAuthenticationError, ConnectorInputError, isCallerError } from './errors.js';
import { parseIsoCalendarDate, timeToSeconds, toTurkeyLocalTime } from './mock/turkeyTime.js';
import type { ResilientConnectorExecutor, ResilientResult, ResultSource } from './resilience/ResilientConnectorExecutor.js';
import { systemClock, type CampusConnectorSet, type Clock, type ConnectorName } from './types.js';

/** Envelope returned by every connector-backed tool handler. Extends the shared MCPToolResponse. */
export interface ConnectorToolResponse<T = unknown> extends MCPToolResponse<T> {
  source: ResultSource;
  /** True when the data comes from a mock (synthetic) connector. Absent on errors. */
  isSimulated?: boolean;
  durationMs?: number;
  /** JSON-RPC style code for errors: -32602 (invalid input) or a connector failure code. */
  code?: number | string;
  message?: string;
}

export type ConnectorToolHandler = (args: any, auth: AuthContext) => Promise<ConnectorToolResponse>;

export interface ConnectorHandlerDeps {
  connectors: CampusConnectorSet;
  executor: ResilientConnectorExecutor;
  ttlSeconds: Record<ConnectorName, number>;
  clock?: Clock;
}

function toEnvelope<T>(result: ResilientResult<T>, isSimulated: boolean): ConnectorToolResponse<T> {
  if (result.source === 'ERROR' || result.data === null) {
    const message = result.failure?.message ?? 'The campus service is currently unavailable.';
    return {
      isError: true,
      source: 'ERROR',
      code: result.failure?.code ?? 'UPSTREAM_ERROR',
      message,
      content: [{ type: 'text', text: message }],
      isStale: false,
      timestamp: result.timestamp,
      durationMs: result.durationMs,
    };
  }
  return {
    isError: false,
    source: result.source,
    content: [
      {
        type: 'json',
        data: result.data,
        isStale: result.isStale,
        isSimulated,
        timestamp: result.timestamp,
        source: result.source,
      },
    ],
    isStale: result.isStale,
    isSimulated,
    timestamp: result.timestamp,
    durationMs: result.durationMs,
  };
}

function callerErrorEnvelope(err: ConnectorInputError | ConnectorAuthenticationError, clock: Clock): ConnectorToolResponse {
  const isInput = err instanceof ConnectorInputError;
  return {
    isError: true,
    source: 'ERROR',
    code: isInput ? -32602 : err.code,
    message: err.message,
    content: [{ type: 'text', text: isInput ? `Invalid params: ${err.message}` : err.message }],
    isStale: false,
    timestamp: clock().toISOString(),
  };
}

/** Wraps a handler body so caller errors become structured envelopes instead of -32603 internal errors. */
function guard(
  clock: Clock,
  body: (args: any, auth: AuthContext) => Promise<ConnectorToolResponse>
): ConnectorToolHandler {
  return async (args, auth) => {
    try {
      return await body(args ?? {}, auth);
    } catch (err: unknown) {
      if (isCallerError(err)) {
        return callerErrorEnvelope(err, clock);
      }
      throw err;
    }
  };
}

export function createConnectorToolHandlers(deps: ConnectorHandlerDeps): Record<ToolName, ConnectorToolHandler> {
  const clock = deps.clock ?? systemClock;
  const { connectors, executor, ttlSeconds } = deps;

  const cafeteria = guard(clock, async (args: GetCafeteriaMenuInput) => {
    const date = args.date ?? toTurkeyLocalTime(clock()).isoDate;
    parseIsoCalendarDate(date); // reject impossible dates before touching cache or upstream
    const result = await executor.execute<GetCafeteriaMenuInput, CafeteriaDailyMenu>({
      connectorName: 'cafeteria',
      connector: connectors.cafeteria,
      input: { date },
      cacheKey: cafeteriaCacheKey(date),
      ttlSeconds: ttlSeconds.cafeteria,
    });
    return toEnvelope(result, connectors.cafeteria.isMock);
  });

  const shuttle = guard(clock, async (args: GetShuttleScheduleInput) => {
    const route = args.route ?? 'MAIN_RING';
    const result = await executor.execute<GetShuttleScheduleInput, ShuttleRouteData>({
      connectorName: 'shuttle',
      connector: connectors.shuttle,
      input: { route },
      cacheKey: shuttleCacheKey(route),
      ttlSeconds: ttlSeconds.shuttle,
    });
    if (result.data !== null && result.source !== 'LIVE') {
      // Cached departures may have passed since they were stored; FR-04 requires strictly future times.
      const nowSeconds = toTurkeyLocalTime(clock()).secondsOfDay;
      result.data = {
        ...result.data,
        nextDepartures: result.data.nextDepartures.filter((departure) => timeToSeconds(departure) > nowSeconds),
      };
    }
    return toEnvelope(result, connectors.shuttle.isMock);
  });

  const library = guard(clock, async (args: GetLibraryOccupancyInput) => {
    const floor = args.floor ?? 'ALL';
    const result = await executor.execute<GetLibraryOccupancyInput, LibraryOccupancyReport>({
      connectorName: 'library',
      connector: connectors.library,
      input: { floor },
      cacheKey: libraryCacheKey(floor),
      ttlSeconds: ttlSeconds.library,
    });
    return toEnvelope(result, connectors.library.isMock);
  });

  const courseSchedule = guard(clock, async (args: GetCourseScheduleInput, auth: AuthContext) => {
    const studentId = auth?.studentId?.trim();
    if (!studentId) {
      throw new ConnectorAuthenticationError();
    }
    const day = resolveScheduleDay(args.day, clock());
    const result = await executor.execute<GetCourseScheduleInput, StudentClassEntry[]>({
      connectorName: 'courseSchedule',
      connector: connectors.courseSchedule,
      input: { day },
      context: auth,
      cacheKey: courseScheduleCacheKey(studentId, day),
      ttlSeconds: ttlSeconds.courseSchedule,
    });
    return toEnvelope(result, connectors.courseSchedule.isMock);
  });

  return {
    [TOOL_NAMES.CAFETERIA_MENU]: cafeteria,
    [TOOL_NAMES.SHUTTLE_SCHEDULE]: shuttle,
    [TOOL_NAMES.LIBRARY_OCCUPANCY]: library,
    [TOOL_NAMES.COURSE_SCHEDULE]: courseSchedule,
  };
}

/** Structural type of the MCP server's ToolDispatcher (avoids a package dependency on apps/mcp-server). */
export interface HandlerRegistry {
  registerHandler(name: string, handler: ConnectorToolHandler): void;
}

/** Registers the four connector-backed handlers, replacing any previously registered handler. */
export function registerConnectorHandlers(registry: HandlerRegistry, deps: ConnectorHandlerDeps): void {
  const handlers = createConnectorToolHandlers(deps);
  for (const [name, handler] of Object.entries(handlers)) {
    registry.registerHandler(name, handler);
  }
}
