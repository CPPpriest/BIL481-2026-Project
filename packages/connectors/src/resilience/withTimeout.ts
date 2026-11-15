/**
 * Upstream timeout guard (NFR-01 / FR-10: 800 ms cutoff by default).
 * The timer is always cleared so no handle keeps the process alive.
 */

import { ConnectorTimeoutError } from '../errors.js';

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ConnectorTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
