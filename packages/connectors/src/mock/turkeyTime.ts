/**
 * Türkiye local-time helpers (UTC+3, no daylight saving since 2016).
 *
 * Campus schedules are defined in local time, while the server clock may run in UTC
 * (e.g. inside Docker). All "today", "now" and weekday decisions in the connector tier
 * go through these helpers so that results do not depend on the host time zone.
 */

import { ConnectorInputError } from '../errors.js';

export const TURKEY_UTC_OFFSET_MINUTES = 180;

export const WEEKDAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

export interface TurkeyLocalTime {
  /** Local calendar date, YYYY-MM-DD. */
  isoDate: string;
  /** Local weekday name. */
  weekday: WeekdayName;
  /** Seconds elapsed since local midnight (0 – 86399). */
  secondsOfDay: number;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Converts an absolute instant into Türkiye local date/time parts. */
export function toTurkeyLocalTime(instant: Date): TurkeyLocalTime {
  const shifted = new Date(instant.getTime() + TURKEY_UTC_OFFSET_MINUTES * 60_000);
  const isoDate = `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
  return {
    isoDate,
    weekday: WEEKDAY_NAMES[shifted.getUTCDay()] as WeekdayName,
    secondsOfDay: shifted.getUTCHours() * 3600 + shifted.getUTCMinutes() * 60 + shifted.getUTCSeconds(),
  };
}

/**
 * Parses a YYYY-MM-DD calendar date and returns its weekday.
 * Rejects impossible dates such as 2026-02-30 (the MCP schema only checks the pattern).
 */
export function parseIsoCalendarDate(isoDate: string): { isoDate: string; weekday: WeekdayName } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new ConnectorInputError(`Date must use the YYYY-MM-DD format (received '${isoDate}')`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ConnectorInputError(`'${isoDate}' is not a valid calendar date`);
  }
  return { isoDate, weekday: WEEKDAY_NAMES[date.getUTCDay()] as WeekdayName };
}

/** Parses "HH:MM" into seconds since midnight. */
export function timeToSeconds(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return (hours ?? 0) * 3600 + (minutes ?? 0) * 60;
}

/** Formats minutes since midnight as "HH:MM". */
export function minutesToTime(totalMinutes: number): string {
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;
}

export function isWeekend(weekday: WeekdayName): boolean {
  return weekday === 'SATURDAY' || weekday === 'SUNDAY';
}
