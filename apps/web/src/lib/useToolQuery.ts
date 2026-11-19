'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GatewayClient, QueryResult, ToolName, ToolParams } from './gateway';

export type ToolQueryState<T extends ToolName> =
  | { status: 'loading'; previous: QueryResult<T> | null }
  | { status: 'done'; result: QueryResult<T> };

/**
 * Runs one direct gateway query for a card and re-runs it when the
 * parameters change or `refresh()` is called. An outdated request is
 * cancelled so a slow answer for an old selection never overwrites a newer one.
 */
export function useToolQuery<T extends ToolName>(
  client: GatewayClient,
  toolName: T,
  parameters: ToolParams<T>
): { state: ToolQueryState<T>; refresh: () => void } {
  const [state, setState] = useState<ToolQueryState<T>>({ status: 'loading', previous: null });
  const [attempt, setAttempt] = useState(0);
  const lastResult = useRef<QueryResult<T> | null>(null);
  const parametersKey = JSON.stringify(parameters);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', previous: lastResult.current });

    client
      .query(toolName, JSON.parse(parametersKey) as ToolParams<T>, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        lastResult.current = result;
        setState({ status: 'done', result });
      });

    return () => controller.abort();
  }, [client, toolName, parametersKey, attempt]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, refresh };
}
