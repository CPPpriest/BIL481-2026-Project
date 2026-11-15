/**
 * Fault-injection wrapper for tests and demos (QA Plan TC-06, FR-10, FR-11, NFR-03).
 *
 * Wraps any connector and can make upcoming calls fail or hang, while counting how many calls
 * actually reached the wrapped connector ("upstream calls"). Never used in production wiring.
 */

import type { AuthContext } from '@campus-orchestrator/shared';
import { ConnectorUnavailableError } from '../errors.js';
import type { ConnectorHealth, ConnectorName, ManagedCampusConnector } from '../types.js';

export type InjectedFault = 'error' | 'hang';

export class FaultInjectingConnector<TInput, TOutput> implements ManagedCampusConnector<TInput, TOutput> {
  private readonly faults: InjectedFault[] = [];
  private failAll: InjectedFault | null = null;
  private calls = 0;

  constructor(private readonly inner: ManagedCampusConnector<TInput, TOutput>) {}

  public get name(): ConnectorName {
    return this.inner.name;
  }

  public get mode() {
    return this.inner.mode;
  }

  public get isMock(): boolean {
    return this.inner.isMock;
  }

  /** Number of calls that reached this connector (including failing ones). */
  public get upstreamCalls(): number {
    return this.calls;
  }

  /** Makes the next `count` calls fail with the given fault, then behave normally. */
  public failNext(count: number, fault: InjectedFault = 'error'): void {
    for (let i = 0; i < count; i += 1) {
      this.faults.push(fault);
    }
  }

  /** Makes every call fail until `recover()` is called. */
  public failAlways(fault: InjectedFault = 'error'): void {
    this.failAll = fault;
  }

  public recover(): void {
    this.failAll = null;
    this.faults.length = 0;
  }

  public async execute(input: TInput, context?: AuthContext): Promise<TOutput> {
    this.calls += 1;
    const fault = this.faults.shift() ?? this.failAll;
    if (fault === 'error') {
      throw new ConnectorUnavailableError(`Injected upstream failure for '${this.name}'`);
    }
    if (fault === 'hang') {
      // Never settles: only the executor's timeout can end this call.
      return new Promise<TOutput>(() => undefined);
    }
    return this.inner.execute(input, context);
  }

  public async healthCheck(): Promise<ConnectorHealth> {
    const health = await this.inner.healthCheck();
    return this.failAll === null ? health : { ...health, status: 'DOWN', detail: 'Fault injection active' };
  }
}
