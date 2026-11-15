import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '../../packages/connectors/src/index.js';
import { MONDAY, TestClock } from './helpers.js';

describe('CircuitBreaker (FR-11): 3 consecutive failures → open 60 s → one half-open probe', () => {
  const make = () => {
    const clock = new TestClock(`${MONDAY}T12:00`);
    return { clock, breaker: new CircuitBreaker('cafeteria', { clock: clock.now }) };
  };

  const fail = (breaker: CircuitBreaker) => {
    expect(breaker.tryAcquire()).toBe(true);
    breaker.recordFailure();
  };

  it('stays closed for two failures and opens on the third', () => {
    const { breaker } = make();
    fail(breaker);
    fail(breaker);
    expect(breaker.snapshot().state).toBe('CLOSED');
    fail(breaker);
    expect(breaker.snapshot().state).toBe('OPEN');
    expect(breaker.tryAcquire()).toBe(false);
  });

  it('a success resets the consecutive failure counter', () => {
    const { breaker } = make();
    fail(breaker);
    fail(breaker);
    expect(breaker.tryAcquire()).toBe(true);
    breaker.recordSuccess();
    fail(breaker);
    fail(breaker);
    expect(breaker.snapshot()).toMatchObject({ state: 'CLOSED', consecutiveFailures: 2 });
  });

  it('rejects calls for the whole 60 s cooldown and reports retryAt', () => {
    const { clock, breaker } = make();
    fail(breaker);
    fail(breaker);
    fail(breaker);
    expect(breaker.snapshot().retryAt).toBe(new Date(clock.now().getTime() + 60_000).toISOString());
    clock.advanceSeconds(59);
    expect(breaker.tryAcquire()).toBe(false);
  });

  it('after the cooldown allows exactly one probe; success closes the circuit', () => {
    const { clock, breaker } = make();
    fail(breaker);
    fail(breaker);
    fail(breaker);
    clock.advanceSeconds(60);
    expect(breaker.tryAcquire()).toBe(true);
    expect(breaker.snapshot().state).toBe('HALF_OPEN');
    expect(breaker.tryAcquire()).toBe(false); // second concurrent caller is not a probe
    breaker.recordSuccess();
    expect(breaker.snapshot()).toMatchObject({ state: 'CLOSED', consecutiveFailures: 0, retryAt: null });
    expect(breaker.tryAcquire()).toBe(true);
  });

  it('a failed probe re-opens the circuit for another full cooldown', () => {
    const { clock, breaker } = make();
    fail(breaker);
    fail(breaker);
    fail(breaker);
    clock.advanceSeconds(60);
    fail(breaker); // the probe fails
    expect(breaker.snapshot().state).toBe('OPEN');
    clock.advanceSeconds(59);
    expect(breaker.tryAcquire()).toBe(false);
    clock.advanceSeconds(1);
    expect(breaker.tryAcquire()).toBe(true);
  });

  it('releasing a probe without a result keeps the circuit half-open for the next caller', () => {
    const { clock, breaker } = make();
    fail(breaker);
    fail(breaker);
    fail(breaker);
    clock.advanceSeconds(60);
    expect(breaker.tryAcquire()).toBe(true);
    breaker.releaseWithoutResult();
    expect(breaker.snapshot().state).toBe('HALF_OPEN');
    expect(breaker.tryAcquire()).toBe(true);
  });
});
