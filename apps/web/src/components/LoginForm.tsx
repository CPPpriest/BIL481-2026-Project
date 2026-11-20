'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DEMO_PERSONAS, safeNextPath } from '@/lib/auth';
import { useSession } from './SessionProvider';
import styles from './LoginForm.module.css';

/**
 * Mock-SSO login (FR-15). The student picks one of the synthetic demo
 * personas; no password, real name or student number is ever entered.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const { state, login, logout } = useSession();
  const [personaId, setPersonaId] = useState<string>(DEMO_PERSONAS[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await login(personaId);
    setPending(false);
    if (result.ok) {
      router.replace(next);
      return;
    }
    setError(
      result.code === 'RATE_LIMITED' && result.retryAfterSeconds
        ? `${result.message} ${result.retryAfterSeconds} saniye sonra tekrar dene.`
        : result.message
    );
  }

  if (state.status === 'loading') {
    return <p className={styles.muted}>Oturum kontrol ediliyor…</p>;
  }

  if (state.status === 'authenticated') {
    return (
      <div className={styles.box}>
        <p>
          <strong>{state.session.user.name}</strong> olarak giriş yaptın.
        </p>
        <div className={styles.actions}>
          <Link href={next} className={styles.primaryLink}>
            Devam et
          </Link>
          <button type="button" className={styles.secondaryButton} onClick={logout}>
            Çıkış yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.box} onSubmit={handleSubmit} aria-describedby="login-note">
      {state.endReason && (
        <p className={styles.notice} role="status">
          {state.endReason === 'expired' ? 'Oturumunun süresi doldu.' : 'Oturumun artık geçerli değil.'} Lütfen tekrar giriş yap.
        </p>
      )}

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Demo kullanıcısı seç</legend>
        {DEMO_PERSONAS.map((persona) => (
          <label key={persona.id} className={personaId === persona.id ? `${styles.option} ${styles.optionSelected}` : styles.option}>
            <input
              type="radio"
              name="persona"
              value={persona.id}
              checked={personaId === persona.id}
              onChange={() => setPersonaId(persona.id)}
            />
            <span>
              <span className={styles.optionLabel}>{persona.label}</span>
              <span className={styles.optionMeta}>Öğrenci no: {persona.studentId}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </button>

      <p id="login-note" className={styles.muted}>
        Bu, geliştirme ve demo amaçlı sahte (mock) bir giriştir; gerçek TOBB ETÜ hesabı kullanılmaz. Kullanıcılar
        sentetiktir.
      </p>
    </form>
  );
}
