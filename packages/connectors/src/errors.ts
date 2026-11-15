/**
 * Connector-tier error classes.
 *
 * Two families are distinguished on purpose:
 * - Caller errors (ConnectorInputError, ConnectorAuthenticationError): the request itself is wrong.
 *   They are re-thrown unchanged, are NOT counted as upstream failures and never trigger a stale fallback.
 * - Upstream errors (ConnectorUnavailableError, ConnectorTimeoutError, CircuitOpenError and any
 *   unexpected exception): the data source failed. They count towards the circuit breaker (FR-11)
 *   and activate the stale-if-error fallback (FR-10).
 */

export type ConnectorErrorCode =
  | 'INVALID_INPUT'
  | 'AUTHENTICATION_REQUIRED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'CIRCUIT_OPEN';

export abstract class ConnectorError extends Error {
  public abstract readonly code: ConnectorErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Invalid tool input that passed schema validation but is semantically wrong (e.g. 2026-02-30, unknown day name). */
export class ConnectorInputError extends ConnectorError {
  public readonly code = 'INVALID_INPUT' as const;

  constructor(message: string) {
    super(message);
  }
}

/** A private connector (course schedule) was called without a verified student identity (FR-06, FR-07). */
export class ConnectorAuthenticationError extends ConnectorError {
  public readonly code = 'AUTHENTICATION_REQUIRED' as const;

  constructor(message = 'Authentication required: a verified student identity is needed for the course schedule') {
    super(message);
  }
}

/** The upstream data source cannot be reached (also used by live-mode placeholders whose access is not confirmed). */
export class ConnectorUnavailableError extends ConnectorError {
  public readonly code = 'UPSTREAM_UNAVAILABLE' as const;

  constructor(message: string) {
    super(message);
  }
}

/** The upstream call exceeded the configured cutoff (800 ms by default, NFR-01 / FR-10). */
export class ConnectorTimeoutError extends ConnectorError {
  public readonly code = 'UPSTREAM_TIMEOUT' as const;

  constructor(public readonly timeoutMs: number) {
    super(`Upstream connector did not respond within ${timeoutMs} ms`);
  }
}

/** The connector's circuit breaker is open; no upstream call was attempted (FR-11). */
export class CircuitOpenError extends ConnectorError {
  public readonly code = 'CIRCUIT_OPEN' as const;

  constructor(
    public readonly connector: string,
    public readonly retryAt: string
  ) {
    super(`Circuit for connector '${connector}' is open; next probe allowed at ${retryAt}`);
  }
}

/** True for errors caused by the request itself; those must bypass circuit breaking and stale fallback. */
export function isCallerError(err: unknown): err is ConnectorInputError | ConnectorAuthenticationError {
  return err instanceof ConnectorInputError || err instanceof ConnectorAuthenticationError;
}
