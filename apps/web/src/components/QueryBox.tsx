'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import {
  routeStudentQuery,
  type AgentRoutingReason,
  type DirectIntent,
  type StudentQueryRoute,
} from '@/router/routeStudentQuery';
import styles from './QueryBox.module.css';

/** sessionStorage key the assistant page reads to prefill an agent question (task Y-07). */
export const PENDING_CHAT_MESSAGE_KEY = 'campus.pendingChatMessage';

const INTENT_LABELS: Record<DirectIntent, string> = {
  CAFETERIA: 'Yemekhane menüsü',
  SHUTTLE: 'Ring seferleri',
  LIBRARY: 'Kütüphane doluluğu',
};

const REASON_LABELS: Record<AgentRoutingReason, string> = {
  EMPTY_QUERY: 'Soru boş.',
  COMPOUND_QUERY: 'Birden fazla bilgi isteyen birleşik bir soru.',
  PERSONAL_QUERY: 'Ders programı gibi kişisel bilgi gerektiriyor.',
  AMBIGUOUS_QUERY: 'Birden fazla konuya işaret ediyor.',
  UNMATCHED_QUERY: 'Doğrudan bir karta karşılık gelmiyor.',
};

const EXAMPLES = [
  'Bugün yemekte ne var?',
  'Sonraki ring kaçta?',
  'Kütüphanede boş yer var mı?',
  '10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?',
] as const;

export interface QueryBoxProps {
  /** Called when the router picks a direct card, so the dashboard can point at it. */
  onDirectIntent?: (intent: DirectIntent) => void;
}

/**
 * "Ask a campus question" box from the dashboard wireframe. The deterministic
 * router (FR-16) decides on the client whether the question can be answered by
 * a dashboard card without any LLM call, or must go to the assistant.
 */
export function QueryBox({ onDirectIntent }: QueryBoxProps) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [decision, setDecision] = useState<StudentQueryRoute | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = routeStudentQuery(query);
    setDecision(result);

    if (result.route === 'DIRECT_WIDGET') {
      onDirectIntent?.(result.intent);
      return;
    }

    if (result.reason !== 'EMPTY_QUERY') {
      try {
        window.sessionStorage.setItem(PENDING_CHAT_MESSAGE_KEY, query.trim());
      } catch {
        // Storage can be unavailable (private mode); the user can retype the question.
      }
    }
  }

  return (
    <section className={styles.box} aria-labelledby={`${inputId}-label`}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label id={`${inputId}-label`} htmlFor={inputId} className={styles.label}>
          Kampüsle ilgili bir soru sor
        </label>
        <div className={styles.row}>
          <input
            id={inputId}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Örn. Bugün yemekte ne var?"
            className={styles.input}
            autoComplete="off"
            maxLength={500}
          />
          <button type="submit" className={styles.button}>
            Sor
          </button>
        </div>
      </form>

      <ul className={styles.examples} aria-label="Örnek sorular">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button type="button" className={styles.example} onClick={() => setQuery(example)}>
              {example}
            </button>
          </li>
        ))}
      </ul>

      <div aria-live="polite" className={styles.decisionRegion}>
        {decision && <Decision decision={decision} />}
      </div>
    </section>
  );
}

function Decision({ decision }: { decision: StudentQueryRoute }) {
  if (decision.route === 'DIRECT_WIDGET') {
    return (
      <p className={`${styles.decision} ${styles.direct}`}>
        <strong>Doğrudan kart:</strong> {INTENT_LABELS[decision.intent]}. Bu soru için yapay zekâ
        modeli çağrılmaz; cevap aşağıdaki karttan gelir.
      </p>
    );
  }

  if (decision.reason === 'EMPTY_QUERY') {
    return <p className={`${styles.decision} ${styles.neutral}`}>Lütfen bir soru yaz.</p>;
  }

  return (
    <p className={`${styles.decision} ${styles.agent}`}>
      <strong>Asistana yönlendirilecek:</strong> {REASON_LABELS[decision.reason]}{' '}
      <Link href="/asistan">Asistanda sor</Link>
    </p>
  );
}
