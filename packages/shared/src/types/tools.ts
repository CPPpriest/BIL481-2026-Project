/**
 * MCP Tool Input Types
 */

/**
 * Input parameters for get_cafeteria_menu (FR-03)
 */
export interface GetCafeteriaMenuInput {
  date?: string;
}

/**
 * Valid shuttle routes (FR-04)
 */
export type ShuttleRoute = 'MAIN_RING' | 'METRO_LINE' | 'DORMITORY_LINE';

/**
 * Input parameters for get_shuttle_schedule (FR-04)
 */
export interface GetShuttleScheduleInput {
  route?: ShuttleRoute;
}

/**
 * Valid library floor selectors (FR-05)
 */
export type LibraryFloor = 'FLOOR_1' | 'FLOOR_2' | 'FLOOR_3' | 'ALL';

/**
 * Input parameters for get_library_occupancy (FR-05)
 */
export interface GetLibraryOccupancyInput {
  floor?: LibraryFloor;
}

/**
 * Input parameters for get_course_schedule (FR-06)
 *
 * CRITICAL RULE / SECURITY ENFORCEMENT:
 * Do NOT add `studentId` here. Student identity is strictly sourced
 * from the perimeter authentication context (X-Authenticated-Student-Id)
 * and must never be exposed or accepted as an LLM/client tool input.
 */
export interface GetCourseScheduleInput {
  day?: string;
}
