'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createAppChatClient } from '@/lib/chat/appClient';
import { MAX_MESSAGE_LENGTH } from '@/lib/chat/chatStreamClient';
import { conversationReducer, isTurnOpen, type ConversationTurn } from '@/lib/chat/conversation';
import { endsSession } from '@/lib/chat/presentation';
import { PENDING_CHAT_MESSAGE_KEY } from '../QueryBox';
import { ChatTurnView } from './ChatTurnView';
import styles from './chat.module.css';

const EXAMPLES = [
  '10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?',
  'Bugünkü derslerimden sonra kütüphanede yer bulabilir miyim?',
] as const;

/**
 * Conversational assistant for a logged-in student (UC-04). Each question is
 * streamed from POST /api/v1/chat/stream; one question is answered at a time.
 */
export function ChatView({
  token,
  userName,
  onUnauthorized,
}: {
  token: string;
  userName: string;
  onUnauthorized: () => void;
}) {
  const client = useMemo(() => createAppChatClient(), []);
  const [turns, dispatch] = useReducer(conversationReducer, []);
  const [draft, setDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const logRef = useRef<HTMLOListElement>(null);
  const busy = isTurnOpen(turns[turns.length - 1]);

  // A compound question typed on the dashboard is handed over as a draft (not sent automatically).
  useEffect(() => {
    try {
      const pending = window.sessionStorage.getItem(PENDING_CHAT_MESSAGE_KEY);
      if (pending) {
        setDraft(pending.slice(0, MAX_MESSAGE_LENGTH));
        window.sessionStorage.removeItem(PENDING_CHAT_MESSAGE_KEY);
      }
    } catch {
      // Storage unavailable: nothing to prefill.
    }
  }, []);

  // Stop a running answer when the page is left.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns]);

  const run = useCallback(
    async (id: string, question: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const final = await client.send(question, {
        token,
        signal: controller.signal,
        onUpdate: (answer) => dispatch({ type: 'update', id, answer }),
      });
      if (abortRef.current === controller) abortRef.current = null;
      if (final.error && endsSession(final.error)) onUnauthorized();
    },
    [client, token, onUnauthorized]
  );

  function send() {
    const question = draft.trim();
    if (busy || question.length === 0) return;
    nextId.current += 1;
    const id = `turn-${nextId.current}`;
    dispatch({ type: 'start', id, question });
    setDraft('');
    void run(id, question);
  }

  function retry(turn: ConversationTurn) {
    if (busy) return;
    dispatch({ type: 'restart', id: turn.id });
    void run(turn.id, turn.question);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a new line.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - draft.length;

  return (
    <section className={styles.chat} aria-label="Sohbet">
      {turns.length === 0 ? (
        <div className={styles.welcome}>
          <p>
            Merhaba <strong>{userName}</strong>. Ders programın, ring saatleri ve yemekhane menüsünü birlikte gerektiren
            soruları sorabilirsin.
          </p>
          <ul className={styles.examples} aria-label="Örnek sorular">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button type="button" className={styles.example} onClick={() => setDraft(example)}>
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol ref={logRef} className={styles.log} role="log" aria-live="polite" aria-label="Sohbet geçmişi">
          {turns.map((turn) => (
            <ChatTurnView key={turn.id} turn={turn} onRetry={retry} />
          ))}
        </ol>
      )}

      <form className={styles.composer} onSubmit={handleSubmit} aria-label="Mesaj gönder">
        <label htmlFor="chat-message" className="visually-hidden">
          Mesajın
        </label>
        <textarea
          id="chat-message"
          className={styles.textarea}
          rows={2}
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Örn. 10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?"
          aria-describedby="chat-hint"
        />
        {busy ? (
          <button type="button" className={`${styles.button} ${styles.stop}`} onClick={() => abortRef.current?.abort()}>
            Durdur
          </button>
        ) : (
          <button type="submit" className={styles.button} disabled={draft.trim().length === 0}>
            Gönder
          </button>
        )}
      </form>
      <p id="chat-hint" className={styles.hint}>
        Enter: gönder · Shift+Enter: yeni satır
        {remaining <= 100 && ` · ${remaining} karakter kaldı`} · Cevaplar sentetik (örnek) kampüs verisine dayanır.
      </p>
    </section>
  );
}
