/**
 * Synthetic course catalog for the SIS connector (FR-06).
 * There is no student API access (Project Definition §4.3); course offerings, instructors and rooms
 * below are fictional fixtures used only to produce realistic, deterministic schedules.
 */

import type { WeekdayName } from '../turkeyTime.js';

export interface CourseMeetingFixture {
  day: WeekdayName;
  startTime: string;
  endTime: string;
  classroom: string;
}

export interface CourseFixture {
  courseCode: string;
  courseTitle: string;
  instructor: string;
  meetings: readonly CourseMeetingFixture[];
}

/** Every synthetic student is enrolled in BIL 481 so that UC-04 demos always have a class. */
export const CORE_COURSE: CourseFixture = {
  courseCode: 'BIL 481',
  courseTitle: 'Software Engineering',
  instructor: 'Instructor A (synthetic)',
  meetings: [
    { day: 'TUESDAY', startTime: '08:30', endTime: '10:20', classroom: 'TM-213' },
    { day: 'THURSDAY', startTime: '13:30', endTime: '15:20', classroom: 'TM-213' },
  ],
};

export const ELECTIVE_COURSES: readonly CourseFixture[] = [
  {
    courseCode: 'BIL 421',
    courseTitle: 'Machine Learning',
    instructor: 'Instructor B (synthetic)',
    meetings: [
      { day: 'MONDAY', startTime: '10:30', endTime: '12:20', classroom: 'B-104' },
      { day: 'WEDNESDAY', startTime: '10:30', endTime: '11:20', classroom: 'B-104' },
    ],
  },
  {
    courseCode: 'BIL 441',
    courseTitle: 'Computer Graphics',
    instructor: 'Instructor C (synthetic)',
    meetings: [
      { day: 'MONDAY', startTime: '13:30', endTime: '15:20', classroom: 'TM-105' },
      { day: 'FRIDAY', startTime: '08:30', endTime: '09:20', classroom: 'TM-105' },
    ],
  },
  {
    courseCode: 'BIL 452',
    courseTitle: 'Distributed Systems',
    instructor: 'Instructor D (synthetic)',
    meetings: [
      { day: 'TUESDAY', startTime: '10:30', endTime: '12:20', classroom: 'B-201' },
      { day: 'THURSDAY', startTime: '10:30', endTime: '11:20', classroom: 'B-201' },
    ],
  },
  {
    courseCode: 'BIL 470',
    courseTitle: 'Information Security',
    instructor: 'Instructor E (synthetic)',
    meetings: [
      { day: 'WEDNESDAY', startTime: '13:30', endTime: '15:20', classroom: 'AMFİ-2' },
      { day: 'FRIDAY', startTime: '10:30', endTime: '11:20', classroom: 'AMFİ-2' },
    ],
  },
  {
    courseCode: 'BIL 461',
    courseTitle: 'Database Management Systems',
    instructor: 'Instructor F (synthetic)',
    meetings: [
      { day: 'MONDAY', startTime: '08:30', endTime: '10:20', classroom: 'TM-210' },
      { day: 'THURSDAY', startTime: '15:30', endTime: '16:20', classroom: 'TM-210' },
    ],
  },
  {
    courseCode: 'BIL 372',
    courseTitle: 'Computer Networks',
    instructor: 'Instructor G (synthetic)',
    meetings: [
      { day: 'TUESDAY', startTime: '13:30', endTime: '15:20', classroom: 'B-105' },
      { day: 'FRIDAY', startTime: '13:30', endTime: '14:20', classroom: 'B-105' },
    ],
  },
  {
    courseCode: 'ENG 401',
    courseTitle: 'Technical Writing',
    instructor: 'Instructor H (synthetic)',
    meetings: [{ day: 'WEDNESDAY', startTime: '08:30', endTime: '10:20', classroom: 'Z-12' }],
  },
  {
    courseCode: 'IKT 301',
    courseTitle: 'Engineering Economics',
    instructor: 'Instructor I (synthetic)',
    meetings: [{ day: 'THURSDAY', startTime: '08:30', endTime: '10:20', classroom: 'Z-08' }],
  },
];

/** Number of electives each synthetic student takes in addition to BIL 481. */
export const ELECTIVES_PER_STUDENT = 4;
