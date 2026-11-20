import { describe, expect, it } from 'vitest';
import {
  allergenLabel,
  campusToday,
  formatCampusTime,
  minutesUntil,
  occupancyPercent,
  turkishPart,
} from '../src/lib/format';

describe('display helpers', () => {
  it('shows times and dates in Türkiye time regardless of the machine time zone', () => {
    expect(formatCampusTime('2026-11-23T06:05:00.000Z')).toBe('09:05');
    // 22:30 UTC on the 22nd is already the 23rd in Türkiye.
    expect(campusToday(new Date('2026-11-22T22:30:00.000Z'))).toBe('2026-11-23');
  });

  it('computes minutes until a departure on campus', () => {
    const now = new Date('2026-11-23T06:00:00.000Z'); // 09:00 in Türkiye
    expect(minutesUntil('09:15', now)).toBe(15);
    expect(minutesUntil('08:45', now)).toBe(-15);
  });

  it('never divides by zero and clamps occupancy to 0..100', () => {
    expect(occupancyPercent(0, 0)).toBe(0);
    expect(occupancyPercent(45, 60)).toBe(75);
    expect(occupancyPercent(130, 100)).toBe(100);
  });

  it('translates known allergens and keeps unknown ones', () => {
    expect(allergenLabel('milk')).toBe('süt');
    expect(allergenLabel('lupin')).toBe('lupin');
  });

  it('shows the Turkish half of "English / Türkçe" connector reasons', () => {
    expect(turkishPart('Closed on weekends. / Hafta sonu yemekhane hizmeti yoktur.')).toBe(
      'Hafta sonu yemekhane hizmeti yoktur.'
    );
    expect(turkishPart('Kapalı')).toBe('Kapalı');
  });
});
