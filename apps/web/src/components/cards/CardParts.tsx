import type { QueryErrorCode, ResponseMeta } from '@/lib/gateway';
import { formatCampusTime } from '@/lib/format';
import styles from './CardParts.module.css';

const SOURCE_LABELS: Record<ResponseMeta['source'], string> = {
  LIVE: 'Yeni sorgu',
  CACHE_HIT: 'Önbellekten',
  STALE: 'Eski veri',
  ERROR: 'Hata',
};

/**
 * Badges for the response metadata. Simulation (`isSimulated`) and execution
 * source (`source`) are shown separately, as the contract requires: "Yeni
 * sorgu" means a fresh connector run, not real university data.
 */
export function MetaBadges({ meta }: { meta: ResponseMeta }) {
  return (
    <ul className={styles.badges} aria-label="Veri bilgisi">
      {meta.isSimulated && (
        <li className={`${styles.badge} ${styles.simulated}`} title="Bu veri gerçek kampüs sistemlerinden değil, sentetik olarak üretildi.">
          Sentetik veri
        </li>
      )}
      <li className={meta.source === 'STALE' ? `${styles.badge} ${styles.stale}` : styles.badge}>
        {SOURCE_LABELS[meta.source]}
      </li>
    </ul>
  );
}

/** Freshness warning for stale-if-error answers (FR-10, FR-19). */
export function StaleNotice({ meta }: { meta: ResponseMeta }) {
  if (!meta.isStale) return null;
  return (
    <p className={styles.staleNotice} role="status">
      <strong>Bu bilgi güncel olmayabilir.</strong> Servise şu an ulaşılamadığı için en son kaydedilen veri
      gösteriliyor (kayıt saati {formatCampusTime(meta.timestamp)}).
    </p>
  );
}

const ERROR_MESSAGES: Record<QueryErrorCode, string> = {
  INVALID_PARAMS: 'Geçersiz bir seçim gönderildi.',
  AUTHENTICATION_REQUIRED: 'Bu bilgiyi görmek için giriş yapmalısın.',
  RATE_LIMITED: 'Çok fazla istek gönderildi.',
  UPSTREAM_UNAVAILABLE: 'Kampüs servisine şu an ulaşılamıyor ve kayıtlı bir veri yok.',
  DOWNSTREAM_ERROR: 'Sistemde bir bağlantı sorunu var.',
  UPSTREAM_TIMEOUT: 'Kampüs servisi zamanında cevap vermedi.',
  INTERNAL_ERROR: 'Beklenmeyen bir hata oluştu.',
  NETWORK_ERROR: 'Sunucuya ulaşılamadı. Bağlantını kontrol et.',
  CLIENT_TIMEOUT: 'Sunucu zamanında cevap vermedi.',
  INVALID_RESPONSE: 'Sunucudan beklenmeyen bir cevap geldi.',
  ABORTED: 'İstek iptal edildi.',
};

export function QueryError({
  code,
  retryAfterSeconds,
  onRetry,
}: {
  code: QueryErrorCode;
  retryAfterSeconds?: number;
  onRetry: () => void;
}) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorText}>
        {ERROR_MESSAGES[code]}
        {code === 'RATE_LIMITED' && retryAfterSeconds !== undefined && ` ${retryAfterSeconds} saniye sonra tekrar dene.`}
      </p>
      <button type="button" className={styles.secondaryButton} onClick={onRetry}>
        Tekrar dene
      </button>
    </div>
  );
}

export function CardFooter({
  meta,
  loading,
  onRefresh,
}: {
  meta: ResponseMeta | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <footer className={styles.footer}>
      <span className={styles.updated}>
        {meta ? `Güncellendi: ${formatCampusTime(meta.timestamp)}` : ' '}
        {meta?.durationMs !== undefined && <span className={styles.duration}> · {meta.durationMs} ms</span>}
      </span>
      <button type="button" className={styles.linkButton} onClick={onRefresh} disabled={loading}>
        {loading ? 'Yükleniyor…' : 'Yenile'}
      </button>
    </footer>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.skeletonGroup} role="status" aria-label="Yükleniyor">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={styles.skeleton} aria-hidden="true" />
      ))}
    </div>
  );
}
