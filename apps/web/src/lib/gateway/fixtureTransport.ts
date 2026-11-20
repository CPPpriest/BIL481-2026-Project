/**
 * Fixture transport: a stand-in for the gateway while its real MCP proxy is
 * not ready (team guide "do not wait" rule). It answers `POST /api/v1/query`
 * with HTTP responses shaped exactly like API Contract v1.1 §3.2 / §3.4.
 *
 * Values mirror the synthetic data of packages/connectors (dish names, route
 * names and timetables, library floors and capacities) so that switching to
 * the real gateway does not change what the cards look like.
 *
 * IMPORTANT: this is NOT the backend. Anything rendered in fixture mode must
 * not be reported as an end-to-end result; the UI shows a banner in this mode.
 */
import type {
  CafeteriaDailyMenu,
  LibraryFloorOccupancy,
  LibraryOccupancyReport,
  ShuttleRouteData,
  StudentClassEntry,
} from '@campus-orchestrator/shared';
import type { DataSource, GatewayErrorBody, GatewayErrorCode, QuerySuccessBody, ToolName } from './types';
import type { Transport } from './client';

/** Failure modes that can be forced to check how the UI behaves (task Y-08). */
export type FixtureScenario = 'normal' | 'stale' | 'upstream-unavailable' | 'rate-limited' | 'network-error';

export const FIXTURE_SCENARIOS: readonly FixtureScenario[] = [
  'normal',
  'stale',
  'upstream-unavailable',
  'rate-limited',
  'network-error',
];

export interface FixtureTransportOptions {
  scenario?: FixtureScenario;
  /** Clock override for tests; defaults to the real time. */
  now?: () => Date;
  /** Artificial latency so loading states are visible; 0 in tests. */
  latencyMs?: number;
}

const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000; // Türkiye is UTC+3 all year

/* ---------- synthetic catalog (same values as packages/connectors mock fixtures) ---------- */

const SOUPS = [
  { name: 'Mercimek Çorbası', calories: 180, allergens: [] },
  { name: 'Ezogelin Çorbası', calories: 190, allergens: [] },
  { name: 'Yayla Çorbası', calories: 170, allergens: ['milk', 'egg'] },
  { name: 'Domates Çorbası', calories: 150, allergens: ['milk', 'gluten'] },
] as const;
const MAIN_DISHES = [
  { name: 'Orman Kebabı', calories: 420, allergens: [] },
  { name: 'Tavuk Sote', calories: 380, allergens: [] },
  { name: 'Fırın Köfte', calories: 450, allergens: ['gluten', 'egg'] },
  { name: 'Etli Nohut', calories: 400, allergens: [] },
] as const;
const VEGETARIAN = [
  { name: 'Zeytinyağlı Taze Fasulye', calories: 210, allergens: [] },
  { name: 'Mücver', calories: 260, allergens: ['egg', 'gluten', 'milk'] },
  { name: 'Sebzeli Güveç', calories: 230, allergens: [] },
] as const;
const SIDES = [
  { name: 'Pirinç Pilavı', calories: 220, allergens: [] },
  { name: 'Bulgur Pilavı', calories: 200, allergens: ['gluten'] },
  { name: 'Cacık', calories: 90, allergens: ['milk'] },
] as const;
const WEEKEND_CLOSED_REASON =
  'The cafeteria does not serve meals on weekends (Saturday/Sunday). / Hafta sonu yemekhane hizmeti yoktur.';

const ROUTES = {
  MAIN_RING: {
    routeName: 'Ana Ring Hattı (Kampüs – Metro – Yurtlar)',
    weekday: { first: '07:30', last: '22:00', interval: 15 },
    weekend: { first: '09:00', last: '21:00', interval: 30 },
    peakVehicles: 4,
  },
  METRO_LINE: {
    routeName: 'Metro Bağlantı Hattı (Kampüs – Metro Durağı)',
    weekday: { first: '07:00', last: '23:00', interval: 20 },
    weekend: { first: '08:00', last: '22:00', interval: 40 },
    peakVehicles: 3,
  },
  DORMITORY_LINE: {
    routeName: 'Yurtlar Servisi (Ana Kampüs – Yurtlar)',
    weekday: { first: '07:15', last: '21:45', interval: 30 },
    weekend: { first: '10:00', last: '20:00', interval: 60 },
    peakVehicles: 2,
  },
} as const;
const NEXT_DEPARTURE_COUNT = 3;

const LIBRARY_FLOORS = [
  { floorId: 'FLOOR_1', name: 'Zemin Kat - Genel Çalışma & Danışma', maxSeats: 100, isQuietArea: false },
  { floorId: 'FLOOR_2', name: '1. Kat - Bireysel Çalışma & Kitaplık', maxSeats: 120, isQuietArea: false },
  { floorId: 'FLOOR_3', name: '2. Kat - Sessiz Çalışma Salonu', maxSeats: 80, isQuietArea: true },
] as const;

const DEMO_SCHEDULE: StudentClassEntry[] = [
  { courseCode: 'BIL481', courseTitle: 'Yazılım Mühendisliği', instructor: 'Örnek Öğretim Üyesi', classroom: 'TM-213', startTime: '09:30', endTime: '10:20' },
  { courseCode: 'BIL421', courseTitle: 'Yapay Zekâ', instructor: 'Örnek Öğretim Üyesi', classroom: 'TM-105', startTime: '13:30', endTime: '15:20' },
];

/* ---------- transport ---------- */

export function createFixtureTransport({
  scenario = 'normal',
  now = () => new Date(),
  latencyMs = 250,
}: FixtureTransportOptions = {}): Transport {
  return async (_input, init) => {
    if (latencyMs > 0) {
      await delay(latencyMs, init.signal ?? undefined);
    }
    if (scenario === 'network-error') {
      throw new TypeError('Failed to fetch (fixture scenario: network-error)');
    }

    let body: { toolName?: unknown; parameters?: unknown };
    try {
      body = JSON.parse(String(init.body ?? ''));
    } catch {
      return errorResponse(400, 'INVALID_PARAMS', 'Request body is not valid JSON.', now());
    }
    const toolName = body.toolName;
    const parameters = (body.parameters ?? {}) as Record<string, unknown>;

    if (scenario === 'rate-limited') {
      return errorResponse(429, 'RATE_LIMITED', 'Too many requests. Please wait before trying again.', now(), {
        'Retry-After': '30',
      });
    }

    const hasToken = new Headers(init.headers).get('Authorization')?.startsWith('Bearer ') ?? false;

    switch (toolName) {
      case 'get_cafeteria_menu':
      case 'get_shuttle_schedule':
      case 'get_library_occupancy':
        break;
      case 'get_course_schedule':
        if (!hasToken) {
          return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Please log in to see your course schedule.', now());
        }
        break;
      default:
        return errorResponse(400, 'INVALID_PARAMS', 'Unknown tool name.', now());
    }

    if (scenario === 'upstream-unavailable') {
      return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'The campus service is temporarily unavailable.', now());
    }

    const current = now();
    const result = buildData(toolName, parameters, current);
    if (!result.ok) {
      return errorResponse(400, 'INVALID_PARAMS', result.message, current);
    }

    const stale = scenario === 'stale';
    const source: DataSource = stale ? 'STALE' : 'LIVE';
    // For stale data the timestamp is the original (older) cache time, as the contract requires.
    const timestamp = new Date(current.getTime() - (stale ? 25 * 60 * 1000 : 0)).toISOString();
    const success: QuerySuccessBody = {
      ok: true,
      toolName,
      data: result.data,
      meta: { isSimulated: true, isStale: stale, source, timestamp, durationMs: stale ? 4 : 12 },
    } as QuerySuccessBody;
    return jsonResponse(200, success);
  };
}

type BuildResult =
  | { ok: true; data: CafeteriaDailyMenu | ShuttleRouteData | LibraryOccupancyReport | StudentClassEntry[] }
  | { ok: false; message: string };

function buildData(toolName: ToolName, parameters: Record<string, unknown>, now: Date): BuildResult {
  switch (toolName) {
    case 'get_cafeteria_menu':
      return buildMenu(parameters.date, now);
    case 'get_shuttle_schedule':
      return buildShuttle(parameters.route, now);
    case 'get_library_occupancy':
      return buildLibrary(parameters.floor, now);
    case 'get_course_schedule':
      return { ok: true, data: DEMO_SCHEDULE };
  }
}

function buildMenu(dateParam: unknown, now: Date): BuildResult {
  const date = dateParam === undefined ? turkeyDate(now) : dateParam;
  if (typeof date !== 'string' || !isValidIsoDate(date)) {
    return { ok: false, message: 'Invalid date value; expected YYYY-MM-DD.' };
  }
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (day === 0 || day === 6) {
    return { ok: true, data: { date, available: false, unavailableReason: WEEKEND_CLOSED_REASON, lunch: null, dinner: null } };
  }
  const seed = Number(date.slice(8, 10));
  const pick = <T>(list: readonly T[], offset: number): T => list[(seed + offset) % list.length] as T;
  const soup = pick(SOUPS, 0);
  const main = pick(MAIN_DISHES, 0);
  const veg = pick(VEGETARIAN, 0);
  const side = pick(SIDES, 0);
  const dinnerSoup = pick(SOUPS, 1);
  const dinnerMain = pick(MAIN_DISHES, 2);
  const dinnerSide = pick(SIDES, 1);
  const allergens = [...new Set([...soup.allergens, ...main.allergens, ...veg.allergens, ...side.allergens])];
  return {
    ok: true,
    data: {
      date,
      available: true,
      lunch: {
        soup: soup.name,
        mainDish: main.name,
        vegOption: veg.name,
        sideDish: side.name,
        calories: soup.calories + main.calories + side.calories,
        allergens,
      },
      dinner: {
        soup: dinnerSoup.name,
        mainDish: dinnerMain.name,
        sideDish: dinnerSide.name,
        calories: dinnerSoup.calories + dinnerMain.calories + dinnerSide.calories,
      },
    },
  };
}

function buildShuttle(routeParam: unknown, now: Date): BuildResult {
  const routeId = routeParam ?? 'MAIN_RING';
  if (typeof routeId !== 'string' || !Object.hasOwn(ROUTES, routeId)) {
    return { ok: false, message: 'Invalid route value.' };
  }
  const route = ROUTES[routeId as keyof typeof ROUTES];
  const local = new Date(now.getTime() + TURKEY_OFFSET_MS);
  const weekend = local.getUTCDay() === 0 || local.getUTCDay() === 6;
  const timetable = weekend ? route.weekend : route.weekday;
  const nowMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();

  const departures: string[] = [];
  for (let minute = toMinutes(timetable.first); minute <= toMinutes(timetable.last); minute += timetable.interval) {
    if (minute > nowMinutes) {
      departures.push(formatMinutes(minute));
    }
  }
  const nextDepartures = departures.slice(0, NEXT_DEPARTURE_COUNT);
  return {
    ok: true,
    data: {
      routeId,
      routeName: route.routeName,
      nextDepartures,
      activeVehicles: nextDepartures.length > 0 ? route.peakVehicles : 0,
      lastUpdated: now.toISOString(),
    },
  };
}

function buildLibrary(floorParam: unknown, now: Date): BuildResult {
  const selector = floorParam ?? 'ALL';
  if (typeof selector !== 'string' || !['ALL', 'FLOOR_1', 'FLOOR_2', 'FLOOR_3'].includes(selector)) {
    return { ok: false, message: 'Invalid floor value.' };
  }
  const hour = new Date(now.getTime() + TURKEY_OFFSET_MS).getUTCHours();
  const baseRatio = hour < 8 || hour >= 23 ? 0.05 : hour < 11 ? 0.45 : hour < 17 ? 0.78 : 0.6;
  // Occupancy is computed for every floor first and filtered afterwards, so a floor shows the
  // same numbers whether it is requested alone or as part of ALL.
  const floors: LibraryFloorOccupancy[] = LIBRARY_FLOORS.map((floor, index) => {
    const ratio = Math.min(1, baseRatio + (floor.isQuietArea ? 0.1 : 0) - index * 0.04);
    return { ...floor, occupiedSeats: Math.max(0, Math.round(ratio * floor.maxSeats)) };
  }).filter((floor) => selector === 'ALL' || floor.floorId === selector);
  return {
    ok: true,
    data: {
      timestamp: now.toISOString(),
      isSimulated: true,
      totalCapacity: floors.reduce((sum, floor) => sum + floor.maxSeats, 0),
      totalOccupied: floors.reduce((sum, floor) => sum + floor.occupiedSeats, 0),
      floors,
    },
  };
}

/* ---------- helpers ---------- */

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function errorResponse(
  status: number,
  code: GatewayErrorCode,
  message: string,
  now: Date,
  headers: Record<string, string> = {}
): Response {
  const body: GatewayErrorBody = { ok: false, error: { code, message }, timestamp: now.toISOString() };
  return jsonResponse(status, body, headers);
}

function turkeyDate(now: Date): string {
  return new Date(now.getTime() + TURKEY_OFFSET_MS).toISOString().slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}
