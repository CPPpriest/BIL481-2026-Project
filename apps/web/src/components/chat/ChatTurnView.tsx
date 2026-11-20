import type { ConversationTurn } from '@/lib/chat/conversation';
import { canRetry, chatErrorText, endsSession, toolLabel, toolStatusLabel } from '@/lib/chat/presentation';
import styles from './chat.module.css';

/**
 * One question and its streamed answer (UC-04, FR-17, FR-19):
 * one badge per tool invocation, text as it arrives, and the latency and
 * error states with an explicit retry (no automatic reconnect, contract §3.3).
 */
export function ChatTurnView({
  turn,
  onRetry,
}: {
  turn: ConversationTurn;
  onRetry: (turn: ConversationTurn) => void;
}) {
  const { answer } = turn;
  const waiting = (answer.phase === 'connecting' || answer.phase === 'streaming') && answer.text === '';

  return (
    <li className={styles.turn}>
      <div className={styles.question}>
        <span className="visually-hidden">Sen: </span>
        {turn.question}
      </div>

      <div className={styles.answer} aria-busy={answer.phase === 'connecting' || answer.phase === 'streaming'}>
        <span className="visually-hidden">Asistan: </span>

        {answer.tools.length > 0 && (
          <ul className={styles.badges} aria-label="Kullanılan araçlar">
            {answer.tools.map((tool, index) => (
              <li
                key={`${tool.toolName}-${index}`}
                className={tool.status === 'ERROR' || tool.status === 'STALE' ? `${styles.badge} ${styles.badgeWarn}` : styles.badge}
              >
                <span className={styles.badgeName}>{toolLabel(tool.toolName)}</span>
                <span className={styles.badgeMeta}>
                  {toolStatusLabel(tool.status)} · {tool.durationMs} ms
                </span>
              </li>
            ))}
          </ul>
        )}

        {answer.text && <p className={styles.answerText}>{answer.text}</p>}

        {waiting && !answer.slow && (
          <p className={styles.pending} role="status">
            Asistan düşünüyor…
          </p>
        )}
        {answer.slow && (
          <p className={styles.slow} role="status">
            Hâlâ işleniyor; cevap biraz zaman alabilir.
          </p>
        )}

        {answer.phase === 'done' && !answer.isComplete && (
          <p className={styles.note}>Cevap tamamlanmamış olabilir.</p>
        )}

        {answer.phase === 'error' && answer.error && (
          <div className={styles.error} role="alert">
            <p>
              {chatErrorText(answer.error)}
              {answer.text && ' Cevabın gelen kısmı yukarıda.'}
            </p>
            {canRetry(answer.error) && !endsSession(answer.error) && (
              <button type="button" className={styles.retry} onClick={() => onRetry(turn)}>
                {answer.error.code === 'ABORTED' ? 'Tekrar sor' : 'Tekrar dene'}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
