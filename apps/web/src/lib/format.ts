/**
 * Display helpers. All campus times are shown in Türkiye time, whatever the
 * browser's own time zone is.
 */

export const CAMPUS_TIME_ZONE = 'Europe/Istanbul';

const timeFormatter = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: CAMPUS_TIME_ZONE,
});

const longDateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  timeZone: 'UTC',
});

/** "14:05" for an ISO timestamp, in Türkiye time. Returns "—" for an unparsable value. */
export function formatCampusTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : timeFormatter.format(date);
}

/** "23 Kasım Pazartesi" for a YYYY-MM-DD date. */
export function formatMenuDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoDate : longDateFormatter.format(date);
}

/** Today's date (YYYY-MM-DD) on campus. */
export function campusToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: CAMPUS_TIME_ZONE }).format(now);
}

/** Minutes from now until an "HH:mm" departure today on campus; negative if already passed. */
export function minutesUntil(departure: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: CAMPUS_TIME_ZONE,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const [depHour = 0, depMinute = 0] = departure.split(':').map(Number);
  return depHour * 60 + depMinute - (hour * 60 + minute);
}

/** Occupancy percentage, safe for a zero capacity. */
export function occupancyPercent(occupied: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((occupied / capacity) * 100)));
}

const ALLERGEN_LABELS: Record<string, string> = {
  milk: 'süt',
  egg: 'yumurta',
  gluten: 'gluten',
  celery: 'kereviz',
  nuts: 'kuruyemiş',
  peanuts: 'yer fıstığı',
  soy: 'soya',
  fish: 'balık',
  sesame: 'susam',
  mustard: 'hardal',
};

export function allergenLabel(allergen: string): string {
  return ALLERGEN_LABELS[allergen.toLowerCase()] ?? allergen;
}

/**
 * Connector reasons are written "English / Türkçe". Show the Turkish part when
 * that format is used, otherwise the whole text.
 */
export function turkishPart(text: string): string {
  const parts = text.split(' / ');
  return parts.length > 1 ? (parts[parts.length - 1] ?? text).trim() : text;
}
