'use client';

import { useId, useState } from 'react';
import type { LibraryFloor } from '@campus-orchestrator/shared';
import type { GatewayClient } from '@/lib/gateway';
import { occupancyPercent } from '@/lib/format';
import { useToolQuery } from '@/lib/useToolQuery';
import { DataCard } from '../DataCard';
import { CardFooter, CardSkeleton, MetaBadges, QueryError, StaleNotice } from './CardParts';
import styles from './cards.module.css';

const FLOOR_OPTIONS: readonly { value: LibraryFloor; label: string }[] = [
  { value: 'ALL', label: 'Tüm katlar' },
  { value: 'FLOOR_1', label: 'Zemin kat' },
  { value: 'FLOOR_2', label: '1. kat' },
  { value: 'FLOOR_3', label: '2. kat' },
];

/**
 * UC-03 — total and per-floor library occupancy (FR-05, FR-18). The library
 * has no real occupancy feed, so this data is always synthetic and is labelled
 * as such even if a response forgot the flag.
 */
export function LibraryCard({ client, highlighted }: { client: GatewayClient; highlighted: boolean }) {
  const floorSelectId = useId();
  const [floor, setFloor] = useState<LibraryFloor>('ALL');
  const { state, refresh } = useToolQuery(client, 'get_library_occupancy', { floor });
  const result = state.status === 'done' ? state.result : state.previous;
  const loading = state.status === 'loading';
  const meta = result?.ok ? result.meta : null;

  return (
    <DataCard
      id="card-library"
      title="Kütüphane Doluluğu"
      description="Toplam ve kat bazında doluluk."
      highlighted={highlighted}
      badges={meta && <MetaBadges meta={{ ...meta, isSimulated: meta.isSimulated || (result?.ok === true && result.data.isSimulated) }} />}
    >
      <div className={styles.controls}>
        <label htmlFor={floorSelectId} className={styles.controlLabel}>
          Kat
        </label>
        <select
          id={floorSelectId}
          className={styles.input}
          value={floor}
          onChange={(event) => setFloor(event.target.value as LibraryFloor)}
        >
          {FLOOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {!result && <CardSkeleton />}
        {result && !result.ok && <QueryError code={result.code} retryAfterSeconds={result.retryAfterSeconds} onRetry={refresh} />}
        {result?.ok && (
          <>
            <StaleNotice meta={result.meta} />
            <p className={styles.bigNumber}>
              %{occupancyPercent(result.data.totalOccupied, result.data.totalCapacity)}
              <span className={styles.bigNumberLabel}> dolu</span>
            </p>
            <p className={styles.note}>
              {result.data.totalOccupied} / {result.data.totalCapacity} koltuk ·{' '}
              {Math.max(0, result.data.totalCapacity - result.data.totalOccupied)} boş
            </p>
            <ul className={styles.floors}>
              {result.data.floors.map((item) => {
                const percent = occupancyPercent(item.occupiedSeats, item.maxSeats);
                return (
                  <li key={item.floorId} className={styles.floor}>
                    <div className={styles.floorHeader}>
                      <span>
                        {item.name}
                        {item.isQuietArea && <span className={styles.quietTag}>Sessiz</span>}
                      </span>
                      <span className={styles.floorValue}>
                        {item.occupiedSeats}/{item.maxSeats}
                      </span>
                    </div>
                    <div
                      className={styles.bar}
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                      aria-label={`${item.name} doluluk oranı`}
                    >
                      <span
                        className={percent >= 85 ? `${styles.barFill} ${styles.barFillHigh}` : styles.barFill}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <CardFooter meta={meta} loading={loading} onRefresh={refresh} />
    </DataCard>
  );
}
