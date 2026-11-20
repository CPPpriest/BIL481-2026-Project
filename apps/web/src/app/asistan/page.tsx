import type { Metadata } from 'next';
import { AssistantView } from '@/components/AssistantView';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Asistan',
};

/** Conversational assistant page (UC-04, FR-15, FR-17). */
export default function AssistantPage() {
  return (
    <div className={styles.layout}>
      <div>
        <h1 className={styles.title}>Asistan</h1>
        <p className={styles.lead}>
          Ders programın, ring saatleri ve yemekhane menüsünü birlikte düşünmesi gereken soruları burada sorabilirsin.
        </p>
      </div>
      <AssistantView />
    </div>
  );
}
