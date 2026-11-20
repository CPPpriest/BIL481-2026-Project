import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Giriş',
};

export default function LoginPage() {
  return (
    <div className={styles.layout}>
      <div>
        <h1 className={styles.title}>Giriş</h1>
        <p className={styles.lead}>
          Asistanı ve kişisel ders programını kullanmak için giriş yap. Kampüs Özeti kartları giriş yapmadan da
          kullanılabilir.
        </p>
      </div>
      {/* useSearchParams (return path) needs a Suspense boundary on a statically rendered page. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
