'use client';

import { useEffect, useState } from 'react';
import { getDataSourceMode, getFixtureScenario, type FixtureScenario } from '@/lib/gateway';
import styles from './FixtureBanner.module.css';

/**
 * Visible warning while the app runs on local fixtures instead of the real
 * gateway, so screenshots from this mode are never mistaken for end-to-end
 * evidence (team decision, 19 Nov 2026).
 */
export function FixtureBanner() {
  const [scenario, setScenario] = useState<FixtureScenario>('normal');

  useEffect(() => {
    setScenario(getFixtureScenario(window.location.search));
  }, []);

  if (getDataSourceMode() !== 'fixtures') return null;

  return (
    <div className={styles.banner} role="note">
      <strong>Örnek veri modu:</strong> Kartlar ve asistan gerçek backend&apos;e bağlı değil, yerel fixture
      verisi gösteriliyor.
      {scenario !== 'normal' && <> Zorlanan senaryo: <code>{scenario}</code>.</>}
    </div>
  );
}
