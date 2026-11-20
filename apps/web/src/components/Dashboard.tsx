'use client';

import { useMemo, useState } from 'react';
import type { DirectIntent } from '@/router/routeStudentQuery';
import { createAppGatewayClient } from '@/lib/gateway';
import { LibraryCard } from './cards/LibraryCard';
import { MenuCard } from './cards/MenuCard';
import { ShuttleCard } from './cards/ShuttleCard';
import { QueryBox } from './QueryBox';
import styles from './Dashboard.module.css';

const CARD_IDS: Record<DirectIntent, string> = {
  CAFETERIA: 'card-cafeteria',
  SHUTTLE: 'card-shuttle',
  LIBRARY: 'card-library',
};

/**
 * "Campus at a Glance" dashboard (FR-18): the three direct-path cards for
 * UC-01..03. Each card loads its own data through the gateway client; no card
 * calls the LLM agent.
 */
export function Dashboard() {
  const client = useMemo(() => createAppGatewayClient(), []);
  const [highlighted, setHighlighted] = useState<DirectIntent | null>(null);

  function handleDirectIntent(intent: DirectIntent) {
    setHighlighted(intent);
    document.getElementById(CARD_IDS[intent])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className={styles.layout}>
      <QueryBox onDirectIntent={handleDirectIntent} />
      <div className={styles.grid}>
        <MenuCard client={client} highlighted={highlighted === 'CAFETERIA'} />
        <ShuttleCard client={client} highlighted={highlighted === 'SHUTTLE'} />
        <LibraryCard client={client} highlighted={highlighted === 'LIBRARY'} />
      </div>
    </div>
  );
}
