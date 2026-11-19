'use client';

import { useId, useState } from 'react';
import type { GatewayClient } from '@/lib/gateway';
import { allergenLabel, campusToday, formatMenuDate, turkishPart } from '@/lib/format';
import { useToolQuery } from '@/lib/useToolQuery';
import { DataCard } from '../DataCard';
import { CardFooter, CardSkeleton, MetaBadges, QueryError, StaleNotice } from './CardParts';
import styles from './cards.module.css';

/**
 * UC-01 — today's lunch and dinner (FR-03, FR-18). Direct path: one
 * `get_cafeteria_menu` call through the gateway, no LLM involved.
 */
export function MenuCard({ client, highlighted }: { client: GatewayClient; highlighted: boolean }) {
  const dateInputId = useId();
  const [date, setDate] = useState(() => campusToday());
  const { state, refresh } = useToolQuery(client, 'get_cafeteria_menu', { date });
  const result = state.status === 'done' ? state.result : state.previous;
  const loading = state.status === 'loading';
  const meta = result?.ok ? result.meta : null;

  return (
    <DataCard
      id="card-cafeteria"
      title="Yemekhane Menüsü"
      description="Öğle ve akşam yemeği, kalori ve alerjen bilgisi."
      highlighted={highlighted}
      badges={meta && <MetaBadges meta={meta} />}
    >
      <div className={styles.controls}>
        <label htmlFor={dateInputId} className={styles.controlLabel}>
          Tarih
        </label>
        <input
          id={dateInputId}
          type="date"
          className={styles.input}
          value={date}
          onChange={(event) => event.target.value && setDate(event.target.value)}
        />
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {!result && <CardSkeleton lines={4} />}
        {result && !result.ok && <QueryError code={result.code} retryAfterSeconds={result.retryAfterSeconds} onRetry={refresh} />}
        {result?.ok && (
          <>
            <StaleNotice meta={result.meta} />
            <p className={styles.subheading}>{formatMenuDate(result.data.date)}</p>
            {!result.data.available ? (
              <p className={styles.emptyState}>
                {result.data.unavailableReason ? turkishPart(result.data.unavailableReason) : 'Bu gün için menü yok.'}
              </p>
            ) : (
              <div className={styles.meals}>
                {result.data.lunch && (
                  <section aria-label="Öğle yemeği" className={styles.meal}>
                    <h3 className={styles.mealTitle}>
                      Öğle <span className={styles.calories}>{result.data.lunch.calories} kcal</span>
                    </h3>
                    <ul className={styles.dishList}>
                      <li>{result.data.lunch.soup}</li>
                      <li>{result.data.lunch.mainDish}</li>
                      <li>{result.data.lunch.sideDish}</li>
                      <li>
                        <span className={styles.vegTag}>Vejetaryen</span> {result.data.lunch.vegOption}
                      </li>
                    </ul>
                    {result.data.lunch.allergens && result.data.lunch.allergens.length > 0 && (
                      <p className={styles.note}>
                        Alerjenler: {result.data.lunch.allergens.map(allergenLabel).join(', ')}
                      </p>
                    )}
                  </section>
                )}
                {result.data.dinner && (
                  <section aria-label="Akşam yemeği" className={styles.meal}>
                    <h3 className={styles.mealTitle}>
                      Akşam <span className={styles.calories}>{result.data.dinner.calories} kcal</span>
                    </h3>
                    <ul className={styles.dishList}>
                      <li>{result.data.dinner.soup}</li>
                      <li>{result.data.dinner.mainDish}</li>
                      <li>{result.data.dinner.sideDish}</li>
                    </ul>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <CardFooter meta={meta} loading={loading} onRefresh={refresh} />
    </DataCard>
  );
}
