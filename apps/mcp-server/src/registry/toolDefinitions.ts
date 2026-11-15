import { z } from 'zod';
import {
  TOOL_NAMES,
  type ToolName,
} from '@campus-orchestrator/shared';

/**
 * Interface representing an MCP Tool Definition
 * strictly conforming to the official Model Context Protocol (JSON-RPC 2.0).
 */
export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
}

/**
 * -----------------------------------------------------------------------------
 * Zod Schemas for Runtime Validation
 * Strict mode (.strict()) ensures that additionalProperties are rejected.
 * -----------------------------------------------------------------------------
 */

/**
 * Validation schema for get_cafeteria_menu (FR-03)
 */
export const cafeteriaMenuInputSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must match ISO-8601 format (YYYY-MM-DD)')
      .optional()
      .describe('Target date in ISO format (YYYY-MM-DD). Defaults to the current date if omitted.'),
  })
  .strict();

/**
 * Validation schema for get_shuttle_schedule (FR-04)
 */
export const shuttleScheduleInputSchema = z
  .object({
    route: z
      .enum(['MAIN_RING', 'METRO_LINE', 'DORMITORY_LINE'], {
        errorMap: () => ({
          message: 'Invalid route. Allowed values: MAIN_RING, METRO_LINE, DORMITORY_LINE.',
        }),
      })
      .optional()
      .describe('Shuttle ring route to query. Allowed values: MAIN_RING, METRO_LINE, DORMITORY_LINE. Defaults to MAIN_RING.'),
  })
  .strict();

/**
 * Validation schema for get_library_occupancy (FR-05)
 */
export const libraryOccupancyInputSchema = z
  .object({
    floor: z
      .enum(['FLOOR_1', 'FLOOR_2', 'FLOOR_3', 'ALL'], {
        errorMap: () => ({
          message: 'Invalid floor selector. Allowed values: FLOOR_1, FLOOR_2, FLOOR_3, ALL.',
        }),
      })
      .optional()
      .describe('Study floor filter. Allowed values: FLOOR_1, FLOOR_2, FLOOR_3, ALL. Defaults to ALL.'),
  })
  .strict();

/**
 * Validation schema for get_course_schedule (FR-06)
 *
 * CRITICAL RULE / SECURITY ENFORCEMENT:
 * - `studentId` MUST NOT be in this schema.
 * - `.strict()` strictly rejects any input containing `studentId` or any other unknown keys.
 * - Authenticated student identity is supplied solely via internal gateway context (X-Authenticated-Student-Id).
 */
export const courseScheduleInputSchema = z
  .object({
    day: z
      .string()
      .optional()
      .describe('Day of the week filter (e.g. TODAY, MONDAY, TUESDAY). Defaults to TODAY.'),
  })
  .strict();

/**
 * Map of runtime Zod schemas indexed by tool name
 */
export const TOOL_ZOD_SCHEMAS: Record<ToolName, z.ZodType<any>> = {
  [TOOL_NAMES.CAFETERIA_MENU]: cafeteriaMenuInputSchema,
  [TOOL_NAMES.SHUTTLE_SCHEDULE]: shuttleScheduleInputSchema,
  [TOOL_NAMES.LIBRARY_OCCUPANCY]: libraryOccupancyInputSchema,
  [TOOL_NAMES.COURSE_SCHEDULE]: courseScheduleInputSchema,
};

/**
 * -----------------------------------------------------------------------------
 * MCP Registered Tool Definitions (FR-01, FR-03, FR-04, FR-05, FR-06)
 * These definitions are returned during MCP discovery (tools/list)
 * and enforce `additionalProperties: false`.
 * -----------------------------------------------------------------------------
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: TOOL_NAMES.CAFETERIA_MENU,
    description:
      'Retrieves daily cafeteria menu and nutritional details including lunch, dinner, calorie counts, and availability for a given ISO date (FR-03).',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'Target date in ISO format (YYYY-MM-DD). Defaults to the current date if omitted.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: TOOL_NAMES.SHUTTLE_SCHEDULE,
    description:
      'Retrieves live and upcoming scheduled departure times for campus shuttle rings (MAIN_RING, METRO_LINE, DORMITORY_LINE) (FR-04).',
    inputSchema: {
      type: 'object',
      properties: {
        route: {
          type: 'string',
          enum: ['MAIN_RING', 'METRO_LINE', 'DORMITORY_LINE'],
          description:
            'Shuttle ring route identifier. Allowed values: MAIN_RING, METRO_LINE, DORMITORY_LINE. Defaults to MAIN_RING.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: TOOL_NAMES.LIBRARY_OCCUPANCY,
    description:
      'Retrieves real-time library seat occupancy metrics and study floor availability (FLOOR_1, FLOOR_2, FLOOR_3, or ALL) (FR-05).',
    inputSchema: {
      type: 'object',
      properties: {
        floor: {
          type: 'string',
          enum: ['FLOOR_1', 'FLOOR_2', 'FLOOR_3', 'ALL'],
          description:
            'Study floor selector. Allowed values: FLOOR_1, FLOOR_2, FLOOR_3, ALL. Defaults to ALL.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: TOOL_NAMES.COURSE_SCHEDULE,
    description:
      'Retrieves the personal daily academic course schedule for the authenticated student for a given day (FR-06). Requires verified student session context.',
    inputSchema: {
      type: 'object',
      properties: {
        day: {
          type: 'string',
          description: 'Day of week filter (e.g. TODAY, MONDAY, TUESDAY). Defaults to TODAY.',
        },
      },
      additionalProperties: false,
    },
  },
] as const;

/**
 * Validates tool arguments against the tool's registered Zod schema.
 * Rejects unexpected properties, malformed dates, and illegal enums.
 */
export function validateToolArguments<T = unknown>(
  toolName: string,
  args: unknown
): { success: true; data: T } | { success: false; errorMessage: string; details: unknown } {
  const schema = (TOOL_ZOD_SCHEMAS as Record<string, z.ZodType<any>>)[toolName];
  if (!schema) {
    return {
      success: false,
      errorMessage: `Unknown tool: '${toolName}'`,
      details: { tool: toolName },
    };
  }

  // MCP tool calls without parameters may pass undefined, null, or empty object
  const normalizedArgs = args === undefined || args === null ? {} : args;

  const result = schema.safeParse(normalizedArgs);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
      .join('; ');

    return {
      success: false,
      errorMessage: `Invalid parameters for '${toolName}': ${errorDetails}`,
      details: result.error.format(),
    };
  }

  return {
    success: true,
    data: result.data as T,
  };
}
