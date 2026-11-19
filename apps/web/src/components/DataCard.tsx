import type { ReactNode } from 'react';
import styles from './DataCard.module.css';

export interface DataCardProps {
  /** DOM id used by the query box to point the user at the matching card. */
  id: string;
  title: string;
  /** Short description of what the card shows; also used as the accessible description. */
  description: string;
  highlighted?: boolean;
  children: ReactNode;
}

/**
 * Shared frame for the three "Campus at a Glance" cards (FR-18). The content
 * (menu, shuttle, library) is passed in as children by each card.
 */
export function DataCard({ id, title, description, highlighted = false, children }: DataCardProps) {
  const headingId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <section
      id={id}
      className={highlighted ? `${styles.card} ${styles.highlighted}` : styles.card}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
    >
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
      </header>
      <p id={descriptionId} className={styles.description}>
        {description}
      </p>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
