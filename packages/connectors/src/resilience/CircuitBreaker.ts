/**
 * Per-connector circuit breaker (FR-11).
 *
 * States:
 *   CLOSED    → calls pass. Each upstream failure increments a counter; a success resets it.
 *               At `failureThreshold` (3) consecutive failures the circuit OPENS.
 *   OPEN      → calls are rejected without touching the upstream for `cooldownMs` (60 s).
 *   HALF_OPEN → after the cooldown exactly ONE probe call is allowed. Success → CLOSED,
 *               failure → OPEN again for another full cooldown. While the probe is in flight,
 *               other calls are rejected.
 *
 * One instance exists per connector, so a failing cafeteria connector never blocks the
 * library or shuttle connectors (NFR-03 fault isolation).
 */

import { CIRCUIT_COOLDOWN_MS, CIRCUIT_FAILURE_THRESHOLD } from '../config.js';
import { systemClock, type Clock } from '../types.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  clock?: Clock;
}

export interface CircuitSnapshot {
  state: CircuitState;
  consecutiveFailures: number;
  /** ISO time when the next probe is allowed; null unless OPEN. */
  retryAt: string | null;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAtMs = 0;
  private probeInFlight = false;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly clock: Clock;

  constructor(
    public readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? CIRCUIT_FAILURE_THRESHOLD;
    this.cooldownMs = options.cooldownMs ?? CIRCUIT_COOLDOWN_MS;
    this.clock = options.clock ?? systemClock;
  }

  /**
   * Asks permission for one upstream call. Moves OPEN → HALF_OPEN when the cooldown has passed
   * and reserves the single probe slot. Every `true` must be followed by recordSuccess/recordFailure.
   */
  public tryAcquire(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }
    if (this.state === 'OPEN') {
      if (this.clock().getTime() - this.openedAtMs < this.cooldownMs) {
        return false;
      }
      this.state = 'HALF_OPEN';
      this.probeInFlight = false;
    }
    // HALF_OPEN: allow exactly one probe at a time.
    if (this.probeInFlight) {
      return false;
    }
    this.probeInFlight = true;
    return true;
  }

  public recordSuccess(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.probeInFlight = false;
  }

  public recordFailure(): void {
    this.probeInFlight = false;
    if (this.state === 'HALF_OPEN') {
      this.open();
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.open();
    }
  }

  /**
   * Releases a reserved probe slot without counting a result (used when the error was the caller's
   * fault, e.g. invalid input). The state does not change: a HALF_OPEN circuit stays half-open so the
   * next caller may probe the upstream.
   */
  public releaseWithoutResult(): void {
    this.probeInFlight = false;
  }

  public snapshot(): CircuitSnapshot {
    // Reading the state never changes it; an elapsed cooldown is reported as OPEN until a call probes.
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      retryAt: this.state === 'OPEN' ? new Date(this.openedAtMs + this.cooldownMs).toISOString() : null,
    };
  }

  private open(): void {
    this.state = 'OPEN';
    this.openedAtMs = this.clock().getTime();
    this.consecutiveFailures = this.failureThreshold;
  }
}
