/**
 * Mock SIS course-schedule connector — backs the `get_course_schedule` tool (FR-06, FR-12).
 *
 * Security boundary (FR-06, FR-07):
 * - The student is identified ONLY by `context.studentId`, which the MCP dispatcher receives from the
 *   gateway-verified `X-Authenticated-Student-Id` header. The tool input has no studentId field.
 * - Missing/blank studentId → ConnectorAuthenticationError (defence in depth; the dispatcher checks first).
 *
 * Behaviour:
 * - `day` accepts TODAY (default) or MONDAY … SUNDAY, case-insensitive; anything else → ConnectorInputError.
 * - Each student deterministically gets BIL 481 plus ELECTIVES_PER_STUDENT non-overlapping electives,
 *   derived from (seed, studentId). Different students get different but stable schedules.
 * - Returned entries are filtered to the requested day and sorted by startTime. Weekends → [].
 */

import type { AuthContext, GetCourseScheduleInput, StudentClassEntry } from '@campus-orchestrator/shared';
import { ConnectorAuthenticationError, ConnectorInputError } from '../errors.js';
import {
  CORE_COURSE,
  ELECTIVE_COURSES,
  ELECTIVES_PER_STUDENT,
  type CourseFixture,
  type CourseMeetingFixture,
} from '../mock/fixtures/courseFixtures.js';
import { createSeededRandom } from '../mock/seededRandom.js';
import { WEEKDAY_NAMES, timeToSeconds, toTurkeyLocalTime, type WeekdayName } from '../mock/turkeyTime.js';
import { systemClock, type Clock, type ConnectorHealth, type CourseScheduleConnector } from '../types.js';

export const VALID_SCHEDULE_DAYS = ['TODAY', ...WEEKDAY_NAMES] as const;

function overlaps(a: CourseMeetingFixture, b: CourseMeetingFixture): boolean {
  return (
    a.day === b.day &&
    timeToSeconds(a.startTime) < timeToSeconds(b.endTime) &&
    timeToSeconds(b.startTime) < timeToSeconds(a.endTime)
  );
}

/** Resolves the `day` argument to a weekday name in Türkiye time. */
export function resolveScheduleDay(day: string | undefined, now: Date): WeekdayName {
  const normalized = (day ?? 'TODAY').trim().toUpperCase();
  if (normalized === 'TODAY') {
    return toTurkeyLocalTime(now).weekday;
  }
  if ((WEEKDAY_NAMES as readonly string[]).includes(normalized)) {
    return normalized as WeekdayName;
  }
  throw new ConnectorInputError(`Unknown day '${day}'. Valid values: ${VALID_SCHEDULE_DAYS.join(', ')}`);
}

export class MockCourseScheduleConnector implements CourseScheduleConnector {
  public readonly name = 'courseSchedule' as const;
  public readonly mode = 'mock' as const;
  public readonly isMock = true;

  constructor(
    private readonly seed: string,
    private readonly clock: Clock = systemClock
  ) {}

  /** Deterministic enrolment of one student: BIL 481 + non-overlapping electives. */
  public enrolledCourses(studentId: string): CourseFixture[] {
    const random = createSeededRandom(this.seed, 'courseSchedule', studentId);
    const enrolled: CourseFixture[] = [CORE_COURSE];
    for (const course of random.shuffle(ELECTIVE_COURSES)) {
      if (enrolled.length - 1 >= ELECTIVES_PER_STUDENT) {
        break;
      }
      const conflicts = course.meetings.some((meeting) =>
        enrolled.some((taken) => taken.meetings.some((takenMeeting) => overlaps(meeting, takenMeeting)))
      );
      if (!conflicts) {
        enrolled.push(course);
      }
    }
    return enrolled;
  }

  public async execute(input: GetCourseScheduleInput, context?: AuthContext): Promise<StudentClassEntry[]> {
    const studentId = context?.studentId?.trim();
    if (!studentId) {
      throw new ConnectorAuthenticationError();
    }
    const day = resolveScheduleDay(input.day, this.clock());

    return this.enrolledCourses(studentId)
      .flatMap((course) =>
        course.meetings
          .filter((meeting) => meeting.day === day)
          .map<StudentClassEntry>((meeting) => ({
            courseCode: course.courseCode,
            courseTitle: course.courseTitle,
            instructor: course.instructor,
            classroom: meeting.classroom,
            day,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
          }))
      )
      .sort((a, b) => timeToSeconds(a.startTime) - timeToSeconds(b.startTime));
  }

  public async healthCheck(): Promise<ConnectorHealth> {
    return {
      connector: this.name,
      mode: this.mode,
      status: 'UP',
      checkedAt: this.clock().toISOString(),
      detail: 'Deterministic synthetic SIS timetable (no student API access)',
    };
  }
}
