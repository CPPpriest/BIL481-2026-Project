/**
 * Shared test helpers for the connector tier (no network, no real timers unless stated).
 */

/** Mutable test clock. `at('2026-11-16T12:00')` sets Türkiye local time (UTC+3). */
export class TestClock {
  private nowMs: number;

  constructor(turkeyLocal: string) {
    this.nowMs = TestClock.parseTurkeyLocal(turkeyLocal);
  }

  public static parseTurkeyLocal(turkeyLocal: string): number {
    return Date.parse(`${turkeyLocal}:00+03:00`);
  }

  public readonly now = (): Date => new Date(this.nowMs);

  public at(turkeyLocal: string): void {
    this.nowMs = TestClock.parseTurkeyLocal(turkeyLocal);
  }

  public advanceSeconds(seconds: number): void {
    this.nowMs += seconds * 1000;
  }
}

export const SEED = '481-FALL-2026';

/** 2026-11-16 is a Monday, 2026-11-21 a Saturday, 2026-11-22 a Sunday. */
export const MONDAY = '2026-11-16';
export const TUESDAY = '2026-11-17';
export const SATURDAY = '2026-11-21';
