/**
 * ResilientConnectorExecutor — the cache / stale-if-error / circuit-breaker pipeline that sits
 * between an MCP tool handler and a connector (FR-09, FR-10, FR-11, NFR-01, NFR-03).
 *
 * Algorithm for one call:
 *   1. Read the cache entry for the key.
 *      Fresh (now < freshUntil)                    → return it as CACHE_HIT (connector NOT called).
 *   2. Ask the connector's circuit breaker for permission.
 *      Denied (circuit OPEN)                       → fallback (step 5) without any upstream call.
 *   3. Call the connector with an 800 ms timeout.
 *      Success → breaker.recordSuccess(); write cache entry {freshUntil = now + TTL}
 *                with physical retention 3 × TTL; return as LIVE.
 *   4. Failure
 *      Caller error (invalid input / auth)        → re-throw; breaker and cache untouched.
 *      Upstream error (unavailable, timeout, any) → breaker.recordFailure(); fallback.
 *   5. Fallback
 *      Retained (expired) entry exists             → return it as STALE, isStale = true,
 *                                                    timestamp = original cachedAt.
 *      No entry                                    → return ERROR with a user-readable message.
 *
 * A cache read/write failure never fails the tool call: reads degrade to "miss", writes are skipped.
 */

import type { AuthContext, ICampusConnector } from '@campus-orchestrator/shared';
import { CACHE_RETENTION_MULTIPLIER, DEFAULT_UPSTREAM_TIMEOUT_MS } from '../config.js';
import type { CacheEntry, CacheStore } from '../cache/CacheStore.js';
import { CircuitOpenError, ConnectorError, isCallerError, type ConnectorErrorCode } from '../errors.js';
import { systemClock, type Clock, type ConnectorName } from '../types.js';
import { CircuitBreaker, type CircuitBreakerOptions, type CircuitSnapshot } from './CircuitBreaker.js';
import { withTimeout } from './withTimeout.js';

/** Where the returned data came from. Matches AgentTelemetryBadge.status in apps/mcp-server. */
export type ResultSource = 'CACHE_HIT' | 'LIVE' | 'STALE' | 'ERROR';

export interface ResilientFailure {
  code: ConnectorErrorCode | 'UPSTREAM_ERROR';
  /** Safe to show to end users; never contains stack traces or internal identifiers. */
  message: string;
}

export interface ResilientResult<T> {
  source: ResultSource;
  /** Null only when source === 'ERROR'. */
  data: T | null;
  isStale: boolean;
  /** When the returned data was fetched from the connector (ISO). For ERROR: time of the failure. */
  timestamp: string;
  /** Present for STALE (why fresh data was unavailable) and ERROR. */
  failure?: ResilientFailure;
  /** Wall-clock duration of this execute() call in milliseconds (for telemetry badges). */
  durationMs: number;
}

export interface ResilientExecuteRequest<TInput, TOutput> {
  connectorName: ConnectorName;
  connector: ICampusConnector<TInput, TOutput>;
  input: TInput;
  context?: AuthContext;
  cacheKey: string;
  ttlSeconds: number;
}

export interface ResilientExecutorOptions {
  cache: CacheStore;
  clock?: Clock;
  /** Upstream cutoff, default 800 ms. */
  timeoutMs?: number;
  retentionMultiplier?: number;
  breaker?: Omit<CircuitBreakerOptions, 'clock'>;
}

const USER_MESSAGES: Record<ResilientFailure['code'], string> = {
  INVALID_INPUT: 'The request was not valid.',
  AUTHENTICATION_REQUIRED: 'Please sign in to see this information.',
  UPSTREAM_UNAVAILABLE: 'The campus service is currently unavailable. Please try again later.',
  UPSTREAM_TIMEOUT: 'The campus service did not respond in time. Please try again later.',
  CIRCUIT_OPEN: 'The campus service is temporarily paused after repeated failures. Please try again in a minute.',
  UPSTREAM_ERROR: 'The campus service returned an unexpected error. Please try again later.',
};

function toFailure(err: unknown): ResilientFailure {
  const code: ResilientFailure['code'] = err instanceof ConnectorError ? err.code : 'UPSTREAM_ERROR';
  return { code, message: USER_MESSAGES[code] };
}

export class ResilientConnectorExecutor {
  private readonly cache: CacheStore;
  private readonly clock: Clock;
  private readonly timeoutMs: number;
  private readonly retentionMultiplier: number;
  private readonly breakerOptions: Omit<CircuitBreakerOptions, 'clock'>;
  private readonly breakers = new Map<ConnectorName, CircuitBreaker>();

  constructor(options: ResilientExecutorOptions) {
    this.cache = options.cache;
    this.clock = options.clock ?? systemClock;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
    this.retentionMultiplier = options.retentionMultiplier ?? CACHE_RETENTION_MULTIPLIER;
    this.breakerOptions = options.breaker ?? {};
  }

  /** The breaker of one connector (created lazily, one per connector name). */
  public getBreaker(name: ConnectorName): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (breaker === undefined) {
      breaker = new CircuitBreaker(name, { ...this.breakerOptions, clock: this.clock });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  public circuitSnapshot(name: ConnectorName): CircuitSnapshot {
    return this.getBreaker(name).snapshot();
  }

  public async execute<TInput, TOutput>(
    request: ResilientExecuteRequest<TInput, TOutput>
  ): Promise<ResilientResult<TOutput>> {
    const startedAtMs = this.clock().getTime();
    const elapsed = (): number => Math.max(0, this.clock().getTime() - startedAtMs);

    // 1. Cache lookup
    const entry = await this.safeGet<TOutput>(request.cacheKey);
    if (entry !== null && this.clock().getTime() < Date.parse(entry.freshUntil)) {
      return { source: 'CACHE_HIT', data: entry.value, isStale: false, timestamp: entry.cachedAt, durationMs: elapsed() };
    }

    // 2. Circuit breaker
    const breaker = this.getBreaker(request.connectorName);
    if (!breaker.tryAcquire()) {
      const retryAt = breaker.snapshot().retryAt ?? this.clock().toISOString();
      return this.fallback(entry, new CircuitOpenError(request.connectorName, retryAt), elapsed);
    }

    // 3. Upstream call with timeout
    try {
      const value = await withTimeout(request.connector.execute(request.input, request.context), this.timeoutMs);
      breaker.recordSuccess();
      const nowMs = this.clock().getTime();
      const cachedAt = new Date(nowMs).toISOString();
      await this.safeSet(
        request.cacheKey,
        { value, cachedAt, freshUntil: new Date(nowMs + request.ttlSeconds * 1000).toISOString() },
        request.ttlSeconds * this.retentionMultiplier
      );
      return { source: 'LIVE', data: value, isStale: false, timestamp: cachedAt, durationMs: elapsed() };
    } catch (err: unknown) {
      // 4. Caller errors are not upstream failures.
      if (isCallerError(err)) {
        breaker.releaseWithoutResult();
        throw err;
      }
      breaker.recordFailure();
      return this.fallback(entry, err, elapsed);
    }
  }

  // 5. Stale-if-error fallback
  private fallback<T>(entry: CacheEntry<T> | null, err: unknown, elapsed: () => number): ResilientResult<T> {
    const failure = toFailure(err);
    if (entry !== null) {
      return { source: 'STALE', data: entry.value, isStale: true, timestamp: entry.cachedAt, failure, durationMs: elapsed() };
    }
    return {
      source: 'ERROR',
      data: null,
      isStale: false,
      timestamp: this.clock().toISOString(),
      failure,
      durationMs: elapsed(),
    };
  }

  private async safeGet<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      return await this.cache.get<T>(key);
    } catch {
      return null;
    }
  }

  private async safeSet<T>(key: string, entry: CacheEntry<T>, retentionSeconds: number): Promise<void> {
    try {
      await this.cache.set(key, entry, retentionSeconds);
    } catch {
      // Cache outage must not fail a successful upstream call.
    }
  }
}
