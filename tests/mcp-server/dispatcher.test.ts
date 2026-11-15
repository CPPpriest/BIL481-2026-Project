import { describe, it, expect, beforeEach } from 'vitest';
import {
  TOOL_NAMES,
  type AuthContext,
  type CafeteriaDailyMenu,
  type LibraryOccupancyReport,
  type ShuttleRouteData,
  type StudentClassEntry,
} from '@campus-orchestrator/shared';
import {
  ToolDispatcher,
  AuthenticationRequiredError,
  TOOL_DEFINITIONS,
  validateToolArguments,
  sampleCafeteriaHandler,
  sampleLibraryHandler,
  sampleShuttleHandler,
  sampleCourseScheduleHandler,
  registerSampleMockHandlers,
} from '../../apps/mcp-server/src/index.js';

describe('Tool Registry and ToolDispatcher Unit Tests (NFR-08 Offline / Mock)', () => {
  let dispatcher: ToolDispatcher;

  beforeEach(() => {
    dispatcher = new ToolDispatcher();
  });

  // ===========================================================================
  // Scenario 1: tools/list discovery and strict schema compliance (FR-01)
  // ===========================================================================
  describe('Scenario 1: tools/list Tool Registry Compliance (FR-01)', () => {
    it('should register exactly four tools conforming to FR-01 specifications', () => {
      expect(TOOL_DEFINITIONS).toHaveLength(4);

      const registeredNames = TOOL_DEFINITIONS.map((tool) => tool.name);
      expect(registeredNames).toContain(TOOL_NAMES.CAFETERIA_MENU);
      expect(registeredNames).toContain(TOOL_NAMES.SHUTTLE_SCHEDULE);
      expect(registeredNames).toContain(TOOL_NAMES.LIBRARY_OCCUPANCY);
      expect(registeredNames).toContain(TOOL_NAMES.COURSE_SCHEDULE);
    });

    it('should enforce additionalProperties: false on all four tool input schemas', () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(10);
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.additionalProperties).toBe(false);
      }
    });

    it('should strictly exclude studentId from get_course_schedule input properties (FR-06)', () => {
      const courseTool = TOOL_DEFINITIONS.find(
        (t) => t.name === TOOL_NAMES.COURSE_SCHEDULE
      );
      expect(courseTool).toBeDefined();
      expect(courseTool!.inputSchema.properties).toHaveProperty('day');
      expect(courseTool!.inputSchema.properties).not.toHaveProperty('studentId');
    });
  });

  // ===========================================================================
  // Scenario 2: Invalid parameters return JSON-RPC -32602 (FR-01)
  // ===========================================================================
  describe('Scenario 2: Parameter Validation and JSON-RPC -32602 Handling (FR-01)', () => {
    const guestAuth: AuthContext = { role: 'GUEST' };

    it('should return -32602 when get_shuttle_schedule receives an invalid route enum', async () => {
      const invalidArgs = { route: 'INVALID_METRO_EXPRESS' };
      const response = await dispatcher.dispatch(
        TOOL_NAMES.SHUTTLE_SCHEDULE,
        invalidArgs,
        guestAuth
      );

      expect(response.isError).toBe(true);
      expect(response.code).toBe(-32602);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602);
      expect(response.message).toContain('Invalid parameters for \'get_shuttle_schedule\'');
    });

    it('should return -32602 when get_cafeteria_menu receives a malformed date string', async () => {
      const invalidDates = ['16-11-2026', '2026/11/16', 'yesterday', '2026-1-1'];

      for (const badDate of invalidDates) {
        const response = await dispatcher.dispatch(
          TOOL_NAMES.CAFETERIA_MENU,
          { date: badDate },
          guestAuth
        );

        expect(response.isError).toBe(true);
        expect(response.code).toBe(-32602);
        expect(response.error?.code).toBe(-32602);
      }
    });

    it('should return -32602 when get_library_occupancy receives an invalid floor', async () => {
      const response = await dispatcher.dispatch(
        TOOL_NAMES.LIBRARY_OCCUPANCY,
        { floor: 'ROOFTOP' },
        guestAuth
      );

      expect(response.isError).toBe(true);
      expect(response.code).toBe(-32602);
      expect(response.error?.code).toBe(-32602);
    });

    it('should return -32602 when unexpected additional properties are passed to any tool', async () => {
      const response = await dispatcher.dispatch(
        TOOL_NAMES.CAFETERIA_MENU,
        { date: '2026-11-16', unapprovedParam: 'malicious' },
        guestAuth
      );

      expect(response.isError).toBe(true);
      expect(response.code).toBe(-32602);
      expect(response.error?.code).toBe(-32602);
      expect(response.message).toContain('unapprovedParam');
    });

    it('should return -32601 when an unknown tool name is dispatched', async () => {
      const response = await dispatcher.dispatch('get_parking_status', {}, guestAuth);
      expect(response.isError).toBe(true);
      expect(response.code).toBe(-32601);
      expect(response.error?.code).toBe(-32601);
    });
  });

  // ===========================================================================
  // Scenario 3: get_course_schedule authorization & studentId parameter rejection (FR-06, FR-07)
  // ===========================================================================
  describe('Scenario 3: Course Schedule Security and Identity Boundary (FR-06, FR-07)', () => {
    it('should throw an "Authentication required" error when invoked without auth context', async () => {
      const guestAuth: AuthContext = { role: 'GUEST' };

      await expect(
        dispatcher.dispatch(TOOL_NAMES.COURSE_SCHEDULE, { day: 'TODAY' }, guestAuth)
      ).rejects.toThrow(AuthenticationRequiredError);

      await expect(
        dispatcher.dispatch(TOOL_NAMES.COURSE_SCHEDULE, { day: 'TODAY' }, guestAuth)
      ).rejects.toThrow(/Authentication required/i);
    });

    it('should throw an "Authentication required" error when role is STUDENT but studentId is missing or empty', async () => {
      const emptyStudentAuth: AuthContext = { role: 'STUDENT', studentId: '' };

      await expect(
        dispatcher.dispatch(TOOL_NAMES.COURSE_SCHEDULE, { day: 'TODAY' }, emptyStudentAuth)
      ).rejects.toThrow(AuthenticationRequiredError);
    });

    it('should reject requests attempting to pass studentId as an argument via schema validation', async () => {
      const studentAuth: AuthContext = { role: 'STUDENT', studentId: '241101013' };

      // Attacker attempts to forge or pass another student's ID in tool arguments
      const forgedArgs = { day: 'MONDAY', studentId: '241101999' };

      // 1. Direct schema check
      const validation = validateToolArguments(TOOL_NAMES.COURSE_SCHEDULE, forgedArgs);
      expect(validation.success).toBe(false);
      expect(validation.errorMessage).toContain('studentId');

      // 2. Dispatcher execution check
      const response = await dispatcher.dispatch(
        TOOL_NAMES.COURSE_SCHEDULE,
        forgedArgs,
        studentAuth
      );

      expect(response.isError).toBe(true);
      expect(response.code).toBe(-32602);
      expect(response.error?.code).toBe(-32602);
      expect(response.message).toContain('studentId');
    });

    it('should return NOT_IMPLEMENTED when authorized but no handler is registered', async () => {
      const validStudentAuth: AuthContext = { role: 'STUDENT', studentId: '241101013' };

      const response = await dispatcher.dispatch(
        TOOL_NAMES.COURSE_SCHEDULE,
        { day: 'MONDAY' },
        validStudentAuth
      );

      expect(response.isError).toBe(true);
      expect(response.code).toBe('NOT_IMPLEMENTED');
      expect(response.message).toContain('not implemented yet');
    });
  });

  // ===========================================================================
  // Scenario 4: get_cafeteria_menu mock execution returning valid CafeteriaDailyMenu format (FR-03)
  // ===========================================================================
  describe('Scenario 4: Cafeteria Daily Menu Mock Execution (FR-03)', () => {
    beforeEach(() => {
      registerSampleMockHandlers(dispatcher);
    });

    it('should return a valid CafeteriaDailyMenu on weekdays with lunch and dinner details', async () => {
      const guestAuth: AuthContext = { role: 'GUEST' };
      // 2026-11-16 is Monday (weekday)
      const response = await dispatcher.dispatch(
        TOOL_NAMES.CAFETERIA_MENU,
        { date: '2026-11-16' },
        guestAuth
      );

      expect(response.isError).toBe(false);
      expect(Array.isArray(response.content)).toBe(true);

      const menu = (response.content as Array<{ data: CafeteriaDailyMenu }>)[0]!.data;
      expect(menu).toBeDefined();
      expect(menu.date).toBe('2026-11-16');
      expect(menu.available).toBe(true);
      expect(menu.unavailableReason).toBeUndefined();

      // Validate lunch meal structure
      expect(menu.lunch).not.toBeNull();
      expect(typeof menu.lunch!.soup).toBe('string');
      expect(typeof menu.lunch!.mainDish).toBe('string');
      expect(typeof menu.lunch!.vegOption).toBe('string');
      expect(typeof menu.lunch!.sideDish).toBe('string');
      expect(menu.lunch!.calories).toBeGreaterThan(0);
      expect(Array.isArray(menu.lunch!.allergens)).toBe(true);

      // Validate dinner meal structure
      expect(menu.dinner).not.toBeNull();
      expect(typeof menu.dinner!.soup).toBe('string');
      expect(typeof menu.dinner!.mainDish).toBe('string');
      expect(typeof menu.dinner!.sideDish).toBe('string');
      expect(menu.dinner!.calories).toBeGreaterThan(0);
    });

    it('should return available: false with an unavailableReason on weekends', async () => {
      const guestAuth: AuthContext = { role: 'GUEST' };
      // 2026-11-15 is Sunday (weekend)
      const response = await dispatcher.dispatch(
        TOOL_NAMES.CAFETERIA_MENU,
        { date: '2026-11-15' },
        guestAuth
      );

      expect(response.isError).toBe(false);
      const menu = (response.content as Array<{ data: CafeteriaDailyMenu }>)[0]!.data;

      expect(menu.date).toBe('2026-11-15');
      expect(menu.available).toBe(false);
      expect(typeof menu.unavailableReason).toBe('string');
      expect(menu.unavailableReason!.length).toBeGreaterThan(5);
      expect(menu.lunch).toBeNull();
      expect(menu.dinner).toBeNull();
    });
  });

  // ===========================================================================
  // Additional Mock Domain Tests (FR-04, FR-05, FR-06)
  // ===========================================================================
  describe('Additional Mock Handlers Verification (FR-04, FR-05, FR-06)', () => {
    it('should return realistic library occupancy with isSimulated: true (FR-05)', async () => {
      const guestAuth: AuthContext = { role: 'GUEST' };
      const report: LibraryOccupancyReport = await sampleLibraryHandler(
        { floor: 'ALL' },
        guestAuth
      );

      expect(report.isSimulated).toBe(true);
      expect(report.totalCapacity).toBeGreaterThan(0);
      expect(report.totalOccupied).toBeGreaterThan(0);
      expect(report.totalOccupied).toBeLessThanOrEqual(report.totalCapacity);
      expect(report.floors).toHaveLength(3);

      const floorSum = report.floors.reduce((acc, f) => acc + f.occupiedSeats, 0);
      expect(floorSum).toBe(report.totalOccupied);
    });

    it('should isolate a requested floor in library report when floor is specified (FR-05)', async () => {
      const guestAuth: AuthContext = { role: 'GUEST' };
      const report: LibraryOccupancyReport = await sampleLibraryHandler(
        { floor: 'FLOOR_2' },
        guestAuth
      );

      expect(report.floors).toHaveLength(1);
      expect(report.floors[0]!.floorId).toBe('FLOOR_2');
      expect(report.totalOccupied).toBe(report.floors[0]!.occupiedSeats);
    });

    it('should return scheduled departures for campus shuttle route (FR-04)', async () => {
      const guestAuth: AuthContext = { role: 'GUEST' };
      const data: ShuttleRouteData = await sampleShuttleHandler(
        { route: 'MAIN_RING' },
        guestAuth
      );

      expect(data.routeId).toBe('MAIN_RING');
      expect(typeof data.routeName).toBe('string');
      expect(data.activeVehicles).toBeGreaterThan(0);
      expect(data.nextDepartures.length).toBeGreaterThan(0);
    });

    it('should return course schedule for authenticated student with studentId (FR-06)', async () => {
      const studentAuth: AuthContext = { role: 'STUDENT', studentId: '241101013' };
      const courses: StudentClassEntry[] = await sampleCourseScheduleHandler(
        { day: 'TODAY' },
        studentAuth
      );

      expect(courses.length).toBeGreaterThan(0);
      expect(courses[0]!.courseCode).toBe('BIL 481');
      expect(courses[0]!.courseTitle).toContain('241101013');
      expect(courses[0]!.classroom).toBe('TM-213');
    });
  });
});
