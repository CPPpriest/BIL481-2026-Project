/**
 * =============================================================================
 * DEPRECATED SAMPLE MOCK HANDLERS (PHASE 2 SKELETON - TEST-ONLY)
 * =============================================================================
 * NOTICE:
 * The MCP server no longer registers these handlers by default. Since PA3 (M-02) the four
 * tools are backed by `@campus-orchestrator/connectors` (`createConnectorRuntime` +
 * `registerConnectorHandlers`: TTL cache, stale-if-error, circuit breaker, mock/live modes).
 *
 * These fixtures remain only for the Phase 2 unit tests and legacy verification scripts, and
 * are opt-in via `createCampusMcpServer(dispatcher, { registerSampleMocks: true })`.
 * =============================================================================
 */

import {
  TOOL_NAMES,
  type AuthContext,
  type CafeteriaDailyMenu,
  type ShuttleRouteData,
  type LibraryOccupancyReport,
  type StudentClassEntry,
  type GetCafeteriaMenuInput,
  type GetShuttleScheduleInput,
  type GetLibraryOccupancyInput,
  type GetCourseScheduleInput,
} from '@campus-orchestrator/shared';
import type { ToolDispatcher } from '../dispatcher/ToolDispatcher.js';

/**
 * Deterministic Mock Handler for get_cafeteria_menu (FR-03)
 * Distinguishes weekdays from weekends.
 */
export async function sampleCafeteriaHandler(
  input: GetCafeteriaMenuInput,
  _auth: AuthContext
): Promise<CafeteriaDailyMenu> {
  const targetDateStr = input.date ?? new Date().toISOString().slice(0, 10);
  const targetDate = new Date(targetDateStr);

  // Check if weekend (0 = Sunday, 6 = Saturday)
  const dayOfWeek = targetDate.getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (isWeekend) {
    return {
      date: targetDateStr,
      available: false,
      unavailableReason:
        'Hafta sonları kafeterya yemek hizmeti verilmemektedir (Cumartesi / Pazar kapalı).',
      lunch: null,
      dinner: null,
    };
  }

  return {
    date: targetDateStr,
    available: true,
    lunch: {
      soup: 'Süzme Mercimek Çorbası',
      mainDish: 'Orman Kebabı',
      vegOption: 'Zeytinyağlı Taze Fasulye',
      sideDish: 'Şehriyeli Pirinç Pilavı & Naneli Cacık',
      calories: 820,
      allergens: ['Gluten', 'Süt Ürünleri'],
    },
    dinner: {
      soup: 'Ezogelin Çorbası',
      mainDish: 'Fırın Tavuk Baget & Fırın Patates',
      sideDish: 'Bulgur Pilavı & Karışık Komposto',
      calories: 740,
    },
  };
}

/**
 * Deterministic Mock Handler for get_library_occupancy (FR-05)
 * Returns realistic study floor occupancy marked with `isSimulated: true`.
 */
export async function sampleLibraryHandler(
  input: GetLibraryOccupancyInput,
  _auth: AuthContext
): Promise<LibraryOccupancyReport> {
  const allFloors = [
    {
      floorId: 'FLOOR_1',
      name: 'Zemin Kat - Genel Çalışma & Danışma',
      occupiedSeats: 48,
      maxSeats: 100,
      isQuietArea: false,
    },
    {
      floorId: 'FLOOR_2',
      name: '1. Kat - Bireysel Çalışma & Kitaplık',
      occupiedSeats: 82,
      maxSeats: 120,
      isQuietArea: false,
    },
    {
      floorId: 'FLOOR_3',
      name: '2. Kat - Sessiz Çalışma Salonu',
      occupiedSeats: 60,
      maxSeats: 80,
      isQuietArea: true,
    },
  ];

  const targetFloor = input.floor ?? 'ALL';
  const selectedFloors =
    targetFloor === 'ALL'
      ? allFloors
      : allFloors.filter((f) => f.floorId === targetFloor);

  const totalOccupied = selectedFloors.reduce((sum, f) => sum + f.occupiedSeats, 0);
  const totalCapacity = selectedFloors.reduce((sum, f) => sum + f.maxSeats, 0);

  return {
    timestamp: new Date().toISOString(),
    isSimulated: true,
    totalCapacity,
    totalOccupied,
    floors: selectedFloors,
  };
}

/**
 * Deterministic Mock Handler for get_shuttle_schedule (FR-04)
 */
export async function sampleShuttleHandler(
  input: GetShuttleScheduleInput,
  _auth: AuthContext
): Promise<ShuttleRouteData> {
  const route = input.route ?? 'MAIN_RING';

  const routeNames: Record<string, string> = {
    MAIN_RING: 'Ana Ring Hattı (Kampüs - Metro - Öğrenci Yurtları)',
    METRO_LINE: 'Metro Bağlantı Hattı (Kampüs - AŞTİ Metro Durağı)',
    DORMITORY_LINE: 'Yurtlar Doğrudan Servisi (Ana Kampüs - Konukevi)',
  };

  return {
    routeId: route,
    routeName: routeNames[route] ?? 'Kampüs Ring Hattı',
    nextDepartures: ['12:35', '12:50', '13:05', '13:20', '13:35'],
    activeVehicles: 3,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Deterministic Mock Handler for get_course_schedule (FR-06)
 * Requires verified student identity from auth context.
 */
export async function sampleCourseScheduleHandler(
  input: GetCourseScheduleInput,
  auth: AuthContext
): Promise<StudentClassEntry[]> {
  const targetDay = input.day ?? 'TODAY';
  // Use auth context to tailor synthetic class entry
  const studentSuffix = auth.studentId ? ` [Student: ${auth.studentId}]` : '';

  // Return realistic synthetic academic courses for the authenticated student
  return [
    {
      courseCode: 'BIL 481',
      courseTitle: `Software Engineering${studentSuffix}`,
      instructor: 'Dr. Öğretim Üyesi',
      classroom: 'TM-213',
      day: targetDay,
      startTime: '09:30',
      endTime: '12:20',
    },
    {
      courseCode: 'BIL 496',
      courseTitle: 'Cloud Computing & Distributed Systems',
      instructor: 'Prof. Dr.',
      classroom: 'AMFİ-2',
      day: targetDay,
      startTime: '13:30',
      endTime: '15:20',
    },
  ];
}

/**
 * Registers all sample mock handlers to the given ToolDispatcher.
 */
export function registerSampleMockHandlers(dispatcher: ToolDispatcher): void {
  dispatcher.registerHandler(TOOL_NAMES.CAFETERIA_MENU, sampleCafeteriaHandler);
  dispatcher.registerHandler(TOOL_NAMES.LIBRARY_OCCUPANCY, sampleLibraryHandler);
  dispatcher.registerHandler(TOOL_NAMES.SHUTTLE_SCHEDULE, sampleShuttleHandler);
  dispatcher.registerHandler(TOOL_NAMES.COURSE_SCHEDULE, sampleCourseScheduleHandler);
}
