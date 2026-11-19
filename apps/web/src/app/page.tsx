import { Dashboard } from '@/components/Dashboard';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <>
      <div className={styles.intro}>
        <h1 className={styles.title}>Kampüs Özeti</h1>
        <p className={styles.lead}>
          Yemekhane, ring ve kütüphane bilgisi tek ekranda. Tek konulu sorular doğrudan karttan
          cevaplanır; birleşik sorular asistana gider.
        </p>
      </div>
      <Dashboard />
    </>
  );
}
