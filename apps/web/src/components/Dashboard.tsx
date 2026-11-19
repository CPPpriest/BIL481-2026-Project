'use client';

import { useState } from 'react';
import type { DirectIntent } from '@/router/routeStudentQuery';
import { DataCard } from './DataCard';
import { QueryBox } from './QueryBox';
import styles from './Dashboard.module.css';

const CARDS: readonly { intent: DirectIntent; id: string; title: string; description: string }[] = [
  {
    intent: 'CAFETERIA',
    id: 'card-cafeteria',
    title: 'Bugünün Menüsü',
    description: 'Öğle ve akşam yemeği, kalori ve vejetaryen seçenek (UC-01).',
  },
  {
    intent: 'SHUTTLE',
    id: 'card-shuttle',
    title: 'Ring Seferleri',
    description: 'Seçilen hattın yaklaşan kalkış saatleri (UC-02).',
  },
  {
    intent: 'LIBRARY',
    id: 'card-library',
    title: 'Kütüphane Doluluğu',
    description: 'Toplam ve kat bazında doluluk oranı (UC-03).',
  },
];

/**
 * "Campus at a Glance" dashboard (FR-18). The cards are frames only in this
 * step; data loading through the gateway client is added in tasks Y-03..Y-06.
 */
export function Dashboard() {
  const [highlighted, setHighlighted] = useState<DirectIntent | null>(null);

  function handleDirectIntent(intent: DirectIntent) {
    setHighlighted(intent);
    const card = CARDS.find((item) => item.intent === intent);
    if (card) {
      document.getElementById(card.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className={styles.layout}>
      <QueryBox onDirectIntent={handleDirectIntent} />
      <div className={styles.grid}>
        {CARDS.map((card) => (
          <DataCard
            key={card.id}
            id={card.id}
            title={card.title}
            description={card.description}
            highlighted={highlighted === card.intent}
          >
            <div className={styles.placeholder} role="status">
              <span className={styles.skeleton} aria-hidden="true" />
              <span className={styles.skeleton} aria-hidden="true" />
              <span className={`${styles.skeleton} ${styles.short}`} aria-hidden="true" />
              <p className={styles.placeholderText}>Bu kart henüz veri kaynağına bağlanmadı.</p>
            </div>
          </DataCard>
        ))}
      </div>
    </div>
  );
}
