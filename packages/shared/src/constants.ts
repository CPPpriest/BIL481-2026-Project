/**
 * Core Constants for Campus Data Orchestrator
 */

/**
 * MCP Registered Tool Names
 * As specified in FR-01 of the Requirements Document
 */
export const TOOL_NAMES = {
  CAFETERIA_MENU: 'get_cafeteria_menu',
  SHUTTLE_SCHEDULE: 'get_shuttle_schedule',
  LIBRARY_OCCUPANCY: 'get_library_occupancy',
  COURSE_SCHEDULE: 'get_course_schedule',
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

// Individual tool name constants
export const TOOL_GET_CAFETERIA_MENU = 'get_cafeteria_menu' as const;
export const TOOL_GET_SHUTTLE_SCHEDULE = 'get_shuttle_schedule' as const;
export const TOOL_GET_LIBRARY_OCCUPANCY = 'get_library_occupancy' as const;
export const TOOL_GET_COURSE_SCHEDULE = 'get_course_schedule' as const;

/**
 * Cache TTL Configuration (in seconds)
 * As specified in FR-09 of the Requirements Document
 */
export const CACHE_TTL = {
  CAFETERIA: 3600,
  SHUTTLE: 120,
  LIBRARY: 60,
  COURSE_SCHEDULE: 300,
} as const;

export type CacheTTLKey = keyof typeof CACHE_TTL;

// Individual TTL constants
export const CACHE_TTL_CAFETERIA = 3600;
export const CACHE_TTL_SHUTTLE = 120;
export const CACHE_TTL_LIBRARY = 60;
export const CACHE_TTL_COURSE_SCHEDULE = 300;
