'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './SiteHeader.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Kampüs Özeti' },
  { href: '/asistan', label: 'Asistan' },
] as const;

/**
 * Top navigation shared by every page. The session area is a placeholder
 * until mock-SSO login is wired in (task Y-08, FR-15); until then the user is
 * always shown as a guest.
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          Kampüs Asistanı
        </Link>
        <nav aria-label="Ana menü" className={styles.nav}>
          <ul>
            {NAV_ITEMS.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={active ? `${styles.link} ${styles.active}` : styles.link}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={styles.session} aria-label="Oturum durumu">
          <span className={styles.guest}>Misafir</span>
        </div>
      </div>
    </header>
  );
}
