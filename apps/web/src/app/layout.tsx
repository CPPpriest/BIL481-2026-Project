import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { FixtureBanner } from '@/components/FixtureBanner';
import { SiteHeader } from '@/components/SiteHeader';
import styles from './layout.module.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Kampüs Asistanı',
    template: '%s · Kampüs Asistanı',
  },
  description:
    'Yemekhane menüsü, ring seferleri, kütüphane doluluğu ve ders programı için kampüs veri asistanı (BİL481 Group-ASYM).',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <a className="skip-link" href="#main-content">
          İçeriğe geç
        </a>
        <SiteHeader />
        <FixtureBanner />
        <main id="main-content" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        <footer className={styles.footer}>
          <p>
            Kampüs verileri şu an <strong>sentetik (mock)</strong> kaynaklardan gelir; gerçek
            TOBB ETÜ sistemlerine bağlı değildir.
          </p>
        </footer>
      </body>
    </html>
  );
}
