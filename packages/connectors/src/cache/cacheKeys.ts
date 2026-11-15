/**
 * Cache key construction (FR-03, FR-09).
 *
 * Format: `cache:<namespace>:<params>` — e.g. `cache:dining:2026-11-16`, matching the
 * `cache:dining:<date>` example in FR-03 and the `cache:<tool>:<params>` pattern in FR-09.
 *
 * Arguments are resolved to their effective values BEFORE building the key (e.g. an omitted
 * `date` becomes today's date, an omitted `route` becomes MAIN_RING), so "today" and the explicit
 * same date share one cache entry.
 *
 * Course schedules are cached per student (FR-09) but the raw student ID never appears in a key:
 * it is replaced by a SHA-256 hash prefix so Redis keys and key listings contain no PII.
 */

import { createHash } from 'node:crypto';
import type { ConnectorName } from '../types.js';

export const CACHE_KEY_PREFIX = 'cache';

export const CACHE_NAMESPACES: Readonly<Record<ConnectorName, string>> = {
  cafeteria: 'dining',
  shuttle: 'shuttle',
  library: 'library',
  courseSchedule: 'schedule',
};

/** Irreversible, non-PII identifier for a student, used only inside cache keys. */
export function hashStudentId(studentId: string): string {
  return createHash('sha256').update(`campus-cache:${studentId}`).digest('hex').slice(0, 16);
}

export function cafeteriaCacheKey(isoDate: string): string {
  return `${CACHE_KEY_PREFIX}:${CACHE_NAMESPACES.cafeteria}:${isoDate}`;
}

export function shuttleCacheKey(route: string): string {
  return `${CACHE_KEY_PREFIX}:${CACHE_NAMESPACES.shuttle}:${route}`;
}

export function libraryCacheKey(floor: string): string {
  return `${CACHE_KEY_PREFIX}:${CACHE_NAMESPACES.library}:${floor}`;
}

export function courseScheduleCacheKey(studentId: string, weekday: string): string {
  return `${CACHE_KEY_PREFIX}:${CACHE_NAMESPACES.courseSchedule}:${hashStudentId(studentId)}:${weekday}`;
}
