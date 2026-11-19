'use client';

import { useEffect, useState } from 'react';
import type { ShuttleRoute } from '@campus-orchestrator/shared';
import type { GatewayClient } from '@/lib/gateway';
import { minutesUntil } from '@/lib/format';
import { useToolQuery } from '@/lib/useToolQuery';
import { DataCard } from '../DataCard';
import { CardFooter, CardSkeleton, MetaBadges, QueryError, StaleNotice } from './CardParts';
import styles from './cards.module.css';

const ROUTE_OPTIONS: readonly { value: ShuttleRoute; label: string }[] = [
  { value: 'MAIN_RING', label: 'Ana Ring' },
  { value: 'METRO_LINE', label: 'Metro' },
  { value: 'DORMITORY_LINE', label: 'Yurtlar' },
];

/**
 * UC-02 — upcoming shuttle departures for the selected route (FR-04, FR-18).
 * Departures arrive already filtered to the future and sorted by the
 * connector; the card only formats them.
 */
export function ShuttleCard({ client, highlighted }: { client: GatewayClient; highlighted: boolean }) {
  const [route, setRoute] = useState<ShuttleRoute>('MAIN_RING');
  const { state, refresh } = useToolQuery(client, 'get_shuttle_schedule', { route });
  const result = state.status === 'done' ? state.result : state.previous;
  const loading = state.status === 'loading';
  const meta = result?.ok ? result.meta : null;
  const now = useMinuteClock();

  return (
    <DataCard
      id="card-shuttle"
      title="Ring Seferleri"
      description="Seçilen hattın yaklaşan kalkış saatleri."
      highlighted={highlighted}
      badges={meta && <MetaBadges meta={meta} />}
    >
      <div className={styles.segmented} role="radiogroup" aria-label="Hat seçimi">
        {ROUTE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={route === option.value}
            className={route === option.value ? `${styles.segment} ${styles.segmentActive}` : styles.segment}
            onClick={() => setRoute(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {!result && <CardSkeleton />}
        {result && !result.ok && <QueryError code={result.code} retryAfterSeconds={result.retryAfterSeconds} onRetry={refresh} />}
        {result?.ok && (
          <>
            <StaleNotice meta={result.meta} />
            <p className={styles.subheading}>{result.data.routeName}</p>
            {result.data.nextDepartures.length === 0 ? (
              <p className={styles.emptyState}>Bugün bu hatta başka sefer yok.</p>
            ) : (
              <ol className={styles.departures} aria-label="Sonraki kalkışlar">
                {result.data.nextDepartures.map((departure) => {
                  const minutes = now ? minutesUntil(departure, now) : null;
                  return (
                    <li key={departure} className={styles.departure}>
                      <span className={styles.departureTime}>{departure}</span>
                      {minutes !== null && minutes >= 0 && (
                        <span className={styles.departureIn}>{minutes === 0 ? 'şimdi' : `${minutes} dk sonra`}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            <p className={styles.note}>Seferdeki araç: {result.data.activeVehicles}</p>
          </>
        )}
      </div>

      <CardFooter meta={meta} loading={loading} onRefresh={refresh} />
    </DataCard>
  );
}

/** Current time, updated every 30 s; null during server rendering to avoid hydration mismatches. */
function useMinuteClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
