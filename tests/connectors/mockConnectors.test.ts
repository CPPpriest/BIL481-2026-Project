import { describe, expect, it } from 'vitest';
import {
  ConnectorAuthenticationError,
  ConnectorInputError,
  MockCafeteriaConnector,
  MockCourseScheduleConnector,
  MockLibraryConnector,
  MockShuttleConnector,
  expandTimetable,
  SHUTTLE_ROUTES,
  timeToSeconds,
  toTurkeyLocalTime,
} from '../../packages/connectors/src/index.js';
import { MONDAY, SATURDAY, SEED, TestClock } from './helpers.js';

describe('MockCafeteriaConnector (FR-03, FR-12)', () => {
  const clock = new TestClock(`${MONDAY}T11:00`);
  const connector = new MockCafeteriaConnector(SEED, clock.now);

  it('returns lunch and dinner with all fields and calories > 0 on a weekday (TC-01)', async () => {
    const menu = await connector.execute({ date: MONDAY });
    expect(menu.available).toBe(true);
    expect(menu.date).toBe(MONDAY);
    expect(menu.lunch).not.toBeNull();
    expect(menu.dinner).not.toBeNull();
    for (const field of ['soup', 'mainDish', 'vegOption', 'sideDish'] as const) {
      expect(menu.lunch![field].length).toBeGreaterThan(0);
    }
    expect(menu.lunch!.calories).toBeGreaterThan(0);
    expect(Array.isArray(menu.lunch!.allergens)).toBe(true);
    for (const field of ['soup', 'mainDish', 'sideDish'] as const) {
      expect(menu.dinner![field].length).toBeGreaterThan(0);
    }
    expect(menu.dinner!.calories).toBeGreaterThan(0);
  });

  it('never repeats the lunch soup or main dish at dinner', async () => {
    for (let day = 16; day <= 20; day += 1) {
      const menu = await connector.execute({ date: `2026-11-${day}` });
      expect(menu.dinner!.soup).not.toBe(menu.lunch!.soup);
      expect(menu.dinner!.mainDish).not.toBe(menu.lunch!.mainDish);
    }
  });

  it('returns available=false with an explanation on weekends instead of throwing', async () => {
    const menu = await connector.execute({ date: SATURDAY });
    expect(menu).toMatchObject({ date: SATURDAY, available: false, lunch: null, dinner: null });
    expect(menu.unavailableReason).toMatch(/weekend/i);
  });

  it('returns available=false on a listed public holiday', async () => {
    const menu = await connector.execute({ date: '2027-01-01' });
    expect(menu.available).toBe(false);
    expect(menu.unavailableReason).toMatch(/New Year/);
  });

  it('defaults to today in Türkiye time (23:30 UTC is already the next day in TR)', async () => {
    const lateClock = new TestClock(`${MONDAY}T02:30`); // = 2026-11-15T23:30Z
    const menu = await new MockCafeteriaConnector(SEED, lateClock.now).execute({});
    expect(menu.date).toBe(MONDAY);
  });

  it('rejects impossible calendar dates with ConnectorInputError', async () => {
    await expect(connector.execute({ date: '2026-02-30' })).rejects.toBeInstanceOf(ConnectorInputError);
  });

  it('is deterministic: same seed + same date → identical menu; different seed → different week', async () => {
    const a = await new MockCafeteriaConnector(SEED, clock.now).execute({ date: MONDAY });
    const b = await new MockCafeteriaConnector(SEED, clock.now).execute({ date: MONDAY });
    expect(b).toEqual(a);

    const week = ['16', '17', '18', '19', '20'].map((d) => `2026-11-${d}`);
    const seedA = await Promise.all(week.map((date) => new MockCafeteriaConnector('seed-A').execute({ date })));
    const seedB = await Promise.all(week.map((date) => new MockCafeteriaConnector('seed-B').execute({ date })));
    expect(seedB).not.toEqual(seedA);
  });
});

describe('MockShuttleConnector (FR-04, FR-12)', () => {
  it('returns the next three departures strictly after now, sorted ascending (TC-02)', async () => {
    const clock = new TestClock(`${MONDAY}T12:35`);
    const data = await new MockShuttleConnector(SEED, clock.now).execute({ route: 'MAIN_RING' });
    // MAIN_RING weekday: every 15 min from 07:30; 12:35 itself is not "strictly later".
    expect(data.nextDepartures).toEqual(['12:45', '13:00', '13:15']);
    expect(data.routeId).toBe('MAIN_RING');
    expect(data.routeName.length).toBeGreaterThan(0);
    expect(data.lastUpdated).toBe(clock.now().toISOString());
    expect(data.activeVehicles).toBeGreaterThanOrEqual(1);
  });

  it('excludes a departure equal to the current minute once seconds have passed', async () => {
    const clock = new TestClock(`${MONDAY}T12:44`);
    clock.advanceSeconds(30); // 12:44:30
    const data = await new MockShuttleConnector(SEED, clock.now).execute({ route: 'MAIN_RING' });
    expect(data.nextDepartures[0]).toBe('12:45');
    clock.advanceSeconds(30); // 12:45:00 exactly
    const later = await new MockShuttleConnector(SEED, clock.now).execute({ route: 'MAIN_RING' });
    expect(later.nextDepartures[0]).toBe('13:00');
  });

  it('defaults to MAIN_RING', async () => {
    const clock = new TestClock(`${MONDAY}T09:00`);
    const data = await new MockShuttleConnector(SEED, clock.now).execute({});
    expect(data.routeId).toBe('MAIN_RING');
  });

  it('uses the weekend timetable on Saturdays', async () => {
    const clock = new TestClock(`${SATURDAY}T09:10`);
    const data = await new MockShuttleConnector(SEED, clock.now).execute({ route: 'MAIN_RING' });
    expect(data.nextDepartures).toEqual(['09:30', '10:00', '10:30']);
  });

  it('returns an empty list and 0 vehicles after the last departure', async () => {
    const clock = new TestClock(`${MONDAY}T23:30`);
    const data = await new MockShuttleConnector(SEED, clock.now).execute({ route: 'MAIN_RING' });
    expect(data.nextDepartures).toEqual([]);
    expect(data.activeVehicles).toBe(0);
  });

  it('every route returns only future times for every minute of a weekday', async () => {
    const clock = new TestClock(`${MONDAY}T00:00`);
    const connector = new MockShuttleConnector(SEED, clock.now);
    for (let minute = 0; minute < 24 * 60; minute += 7) {
      for (const route of ['MAIN_RING', 'METRO_LINE', 'DORMITORY_LINE'] as const) {
        const data = await connector.execute({ route });
        const nowSeconds = toTurkeyLocalTime(clock.now()).secondsOfDay;
        expect(data.nextDepartures.length).toBeLessThanOrEqual(3);
        for (const departure of data.nextDepartures) {
          expect(timeToSeconds(departure)).toBeGreaterThan(nowSeconds);
        }
        const sorted = [...data.nextDepartures].sort((a, b) => timeToSeconds(a) - timeToSeconds(b));
        expect(data.nextDepartures).toEqual(sorted);
      }
      clock.advanceSeconds(7 * 60);
    }
  });

  it('rejects an unknown route and lists the valid routes', async () => {
    const connector = new MockShuttleConnector(SEED);
    await expect(connector.execute({ route: 'NIGHT_LINE' as never })).rejects.toThrow(
      /MAIN_RING, METRO_LINE, DORMITORY_LINE/
    );
  });

  it('expands timetables correctly (first, last, interval)', () => {
    const departures = expandTimetable(SHUTTLE_ROUTES.DORMITORY_LINE.weekday);
    expect(departures[0]).toBe('07:15');
    expect(departures.at(-1)).toBe('21:45');
    expect(departures).toHaveLength(30);
  });
});

describe('MockLibraryConnector (FR-05, FR-12)', () => {
  it('reports simulated data whose totals equal the floor sums, within capacity (TC-03)', async () => {
    const clock = new TestClock(`${MONDAY}T14:10`);
    const report = await new MockLibraryConnector(SEED, clock.now).execute({});
    expect(report.isSimulated).toBe(true);
    expect(report.floors.map((f) => f.floorId)).toEqual(['FLOOR_1', 'FLOOR_2', 'FLOOR_3']);
    expect(report.totalOccupied).toBe(report.floors.reduce((s, f) => s + f.occupiedSeats, 0));
    expect(report.totalCapacity).toBe(report.floors.reduce((s, f) => s + f.maxSeats, 0));
    expect(report.totalCapacity).toBe(300);
    for (const floor of report.floors) {
      expect(floor.occupiedSeats).toBeGreaterThanOrEqual(0);
      expect(floor.occupiedSeats).toBeLessThanOrEqual(floor.maxSeats);
    }
    expect(report.floors.find((f) => f.floorId === 'FLOOR_3')!.isQuietArea).toBe(true);
    expect(report.timestamp).toBe(clock.now().toISOString());
  });

  it('isolates a single floor and its own totals', async () => {
    const clock = new TestClock(`${MONDAY}T14:10`);
    const report = await new MockLibraryConnector(SEED, clock.now).execute({ floor: 'FLOOR_2' });
    expect(report.floors).toHaveLength(1);
    expect(report.floors[0]!.floorId).toBe('FLOOR_2');
    expect(report.totalCapacity).toBe(120);
    expect(report.totalOccupied).toBe(report.floors[0]!.occupiedSeats);
  });

  it('keeps invariants for every 15-minute bucket of a weekday and a weekend day', async () => {
    for (const date of [MONDAY, SATURDAY]) {
      const clock = new TestClock(`${date}T00:00`);
      const connector = new MockLibraryConnector(SEED, clock.now);
      for (let i = 0; i < 96; i += 1) {
        const report = await connector.execute({ floor: 'ALL' });
        expect(report.totalOccupied).toBe(report.floors.reduce((s, f) => s + f.occupiedSeats, 0));
        for (const floor of report.floors) {
          expect(floor.occupiedSeats).toBeGreaterThanOrEqual(0);
          expect(floor.occupiedSeats).toBeLessThanOrEqual(floor.maxSeats);
        }
        clock.advanceSeconds(15 * 60);
      }
    }
  });

  it('is empty outside opening hours and busier at 14:00 than at 09:00 on a weekday', async () => {
    const clock = new TestClock(`${MONDAY}T03:00`);
    const connector = new MockLibraryConnector(SEED, clock.now);
    expect((await connector.execute({})).totalOccupied).toBe(0);
    clock.at(`${MONDAY}T09:00`);
    const morning = (await connector.execute({})).totalOccupied;
    clock.at(`${MONDAY}T14:00`);
    const afternoon = (await connector.execute({})).totalOccupied;
    expect(afternoon).toBeGreaterThan(morning);
  });

  it('is deterministic for the same seed and instant, and stable within a 15-minute bucket', async () => {
    const clock = new TestClock(`${MONDAY}T14:01`);
    const a = await new MockLibraryConnector(SEED, clock.now).execute({});
    const b = await new MockLibraryConnector(SEED, clock.now).execute({});
    expect(b).toEqual(a);
    clock.at(`${MONDAY}T14:14`);
    const sameBucket = await new MockLibraryConnector(SEED, clock.now).execute({});
    expect(sameBucket.floors).toEqual(a.floors);
  });

  it('rejects an unknown floor selector', async () => {
    await expect(new MockLibraryConnector(SEED).execute({ floor: 'FLOOR_9' as never })).rejects.toBeInstanceOf(
      ConnectorInputError
    );
  });
});

describe('MockCourseScheduleConnector (FR-06, FR-12)', () => {
  const clock = new TestClock(`${MONDAY}T09:00`);
  const connector = new MockCourseScheduleConnector(SEED, clock.now);
  const student = { studentId: '241101065', role: 'STUDENT' as const };

  it('requires a verified studentId from the auth context (TC-04)', async () => {
    await expect(connector.execute({ day: 'MONDAY' })).rejects.toBeInstanceOf(ConnectorAuthenticationError);
    await expect(connector.execute({ day: 'MONDAY' }, { role: 'GUEST' })).rejects.toBeInstanceOf(
      ConnectorAuthenticationError
    );
    await expect(connector.execute({ day: 'MONDAY' }, { studentId: '   ', role: 'STUDENT' })).rejects.toBeInstanceOf(
      ConnectorAuthenticationError
    );
  });

  it('returns classes of the requested day sorted by startTime with all required fields', async () => {
    for (const day of ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']) {
      const classes = await connector.execute({ day }, student);
      const starts = classes.map((c) => timeToSeconds(c.startTime));
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
      for (const entry of classes) {
        expect(entry).toMatchObject({ day });
        for (const field of ['courseCode', 'courseTitle', 'instructor', 'classroom', 'startTime', 'endTime'] as const) {
          expect(entry[field].length).toBeGreaterThan(0);
        }
        expect(timeToSeconds(entry.endTime)).toBeGreaterThan(timeToSeconds(entry.startTime));
      }
    }
  });

  it('always enrols BIL 481 plus four non-overlapping electives', () => {
    for (const studentId of ['241101065', '241101013', '241101009', '241101066', '200000001']) {
      const courses = connector.enrolledCourses(studentId);
      expect(courses[0]!.courseCode).toBe('BIL 481');
      expect(courses).toHaveLength(5);
      const meetings = courses.flatMap((c) => c.meetings);
      for (let i = 0; i < meetings.length; i += 1) {
        for (let j = i + 1; j < meetings.length; j += 1) {
          const a = meetings[i]!;
          const b = meetings[j]!;
          const overlap =
            a.day === b.day &&
            timeToSeconds(a.startTime) < timeToSeconds(b.endTime) &&
            timeToSeconds(b.startTime) < timeToSeconds(a.endTime);
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it('is deterministic per student, and different students get different schedules', async () => {
    const again = new MockCourseScheduleConnector(SEED, clock.now);
    expect(again.enrolledCourses('241101065')).toEqual(connector.enrolledCourses('241101065'));
    const codes = (id: string) => connector.enrolledCourses(id).map((c) => c.courseCode).join(',');
    const distinct = new Set(['241101065', '241101013', '241101009', '241101066'].map(codes));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('resolves TODAY in Türkiye time, accepts lower case, returns [] on weekends', async () => {
    const today = await connector.execute({}, student); // Monday
    const monday = await connector.execute({ day: 'monday' }, student);
    expect(today).toEqual(monday);
    expect(await connector.execute({ day: 'SATURDAY' }, student)).toEqual([]);
  });

  it('rejects an unknown day name and lists valid values', async () => {
    await expect(connector.execute({ day: 'FUNDAY' }, student)).rejects.toThrow(/TODAY, SUNDAY, MONDAY/);
  });

  it('BIL 481 meets on Tuesday 08:30–10:20 in TM-213 (UC-04 demo data)', async () => {
    const classes = await connector.execute({ day: 'TUESDAY' }, student);
    const bil481 = classes.find((c) => c.courseCode === 'BIL 481');
    expect(bil481).toMatchObject({ startTime: '08:30', endTime: '10:20', classroom: 'TM-213' });
  });
});
