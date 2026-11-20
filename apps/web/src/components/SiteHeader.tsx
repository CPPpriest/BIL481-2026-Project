'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from './SessionProvider';
import styles from './SiteHeader.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Kampüs Özeti' },
  { href: '/asistan', label: 'Asistan' },
] as const;

/**
 * Top navigation shared by every page, with the session area of FR-15:
 * a login link for guests, and the synthetic student's name, student number
 * and a one-click sign-out once logged in.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { state, logout } = useSession();

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
        <div className={styles.session} aria-label="Oturum durumu" aria-live="polite">
          {state.status === 'authenticated' ? (
            <>
              <span className={styles.user}>
                <span className={styles.userName}>{state.session.user.name}</span>
                <span className={styles.userId}>No: {state.session.user.studentId}</span>
              </span>
              <button type="button" className={styles.logout} onClick={logout}>
                Çıkış
              </button>
            </>
          ) : state.status === 'guest' ? (
            <>
              <span className={styles.guest}>Misafir</span>
              {!pathname.startsWith('/giris') && (
                <Link href={`/giris?next=${encodeURIComponent(pathname)}`} className={styles.login}>
                  Giriş yap
                </Link>
              )}
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
