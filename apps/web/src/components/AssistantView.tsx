'use client';

import Link from 'next/link';
import { useSession } from './SessionProvider';
import styles from './AssistantView.module.css';

/**
 * Assistant view (UC-04). Every chat message needs a verified student
 * session (API Contract v1.1 §1 "Chat access"), so guests only see how to log
 * in. The streaming chat itself (Y-07) is connected in a later step; until
 * then the composer stays disabled and says so.
 */
export function AssistantView() {
  const { state } = useSession();

  return (
    <section className={styles.conversation} aria-label="Sohbet">
      <div className={styles.empty}>
        {state.status === 'loading' && <p className={styles.muted}>Oturum kontrol ediliyor…</p>}

        {state.status === 'guest' && (
          <div className={styles.notice} role="note">
            {state.endReason && (
              <p>{state.endReason === 'expired' ? 'Oturumunun süresi doldu.' : 'Oturumun artık geçerli değil.'}</p>
            )}
            <p>
              <strong>Asistanı kullanmak için giriş yapmalısın.</strong> Giriş yapmadan da{' '}
              <Link href="/">Kampüs Özeti</Link> sayfasındaki kartları kullanabilirsin.
            </p>
            <Link href="/giris?next=%2Fasistan" className={styles.loginLink}>
              Giriş yap
            </Link>
          </div>
        )}

        {state.status === 'authenticated' && (
          <div className={styles.welcome}>
            <p>
              Merhaba <strong>{state.session.user.name}</strong>. Ders programın, ring saatleri ve yemekhane menüsünü
              birlikte gerektiren soruları burada sorabileceksin.
            </p>
            <p className={styles.muted}>Sohbet bağlantısı henüz eklenmedi.</p>
          </div>
        )}
      </div>

      <form className={styles.composer} aria-label="Mesaj gönder">
        <label htmlFor="chat-message" className="visually-hidden">
          Mesajın
        </label>
        <textarea
          id="chat-message"
          className={styles.textarea}
          rows={2}
          placeholder="Örn. 10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?"
          disabled
        />
        <button type="submit" className={styles.button} disabled>
          Gönder
        </button>
      </form>
    </section>
  );
}
