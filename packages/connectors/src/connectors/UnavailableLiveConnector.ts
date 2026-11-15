/**
 * Live-mode placeholder (FR-12).
 *
 * No live campus source is confirmed yet (Project Definition §4.3): the cafeteria page is "planned",
 * the shuttle timetable is "planned", and the library feed, SIS and SSO are "unavailable".
 * Selecting `*_CONNECTOR_MODE=live` therefore wires this placeholder, which fails every call with
 * ConnectorUnavailableError. Through the resilient executor this produces a stale-cache answer or a
 * structured "service unavailable" error instead of crashing, and the health probe reports DOWN.
 *
 * When access to a source is confirmed, a real live connector class replaces this placeholder for that
 * connector only; nothing else changes because all connectors share the same interface.
 */

import type { AuthContext } from '@campus-orchestrator/shared';
import { ConnectorUnavailableError } from '../errors.js';
import { systemClock, type Clock, type ConnectorHealth, type ConnectorName, type ManagedCampusConnector } from '../types.js';

export class UnavailableLiveConnector<TInput, TOutput> implements ManagedCampusConnector<TInput, TOutput> {
  public readonly mode = 'live' as const;
  public readonly isMock = false;

  constructor(
    public readonly name: ConnectorName,
    private readonly clock: Clock = systemClock
  ) {}

  private reason(): string {
    return `Live mode for the '${this.name}' connector is not implemented: upstream access is not confirmed. Use mock mode.`;
  }

  public async execute(_input: TInput, _context?: AuthContext): Promise<TOutput> {
    throw new ConnectorUnavailableError(this.reason());
  }

  public async healthCheck(): Promise<ConnectorHealth> {
    return {
      connector: this.name,
      mode: this.mode,
      status: 'DOWN',
      checkedAt: this.clock().toISOString(),
      detail: this.reason(),
    };
  }
}
