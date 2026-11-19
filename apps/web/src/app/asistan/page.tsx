import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Asistan',
};

/**
 * Conversational assistant view (UC-04, FR-17). In this step it only shows
 * the layout and the login requirement: per API Contract v1.1 §1 "Chat access"
 * every chat message needs a verified student session. Login (Y-08) and the
 * SSE chat client (Y-07, Y-09) are added in later tasks.
 */
export default function AssistantPage() {
  return (
    <div className={styles.layout}>
      <div>
        <h1 className={styles.title}>Asistan</h1>
        <p className={styles.lead}>
          Ders programın, ring saatleri ve yemekhane menüsünü birlikte düşünmesi gereken soruları
          burada sorabilirsin.
        </p>
      </div>

      <section className={styles.conversation} aria-label="Sohbet">
        <div className={styles.empty}>
          <p className={styles.notice} role="note">
            <strong>Asistanı kullanmak için giriş yapmalısın.</strong> Giriş yapmadan da{' '}
            <Link href="/">Kampüs Özeti</Link> sayfasındaki kartları kullanabilirsin.
          </p>
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
    </div>
  );
}
