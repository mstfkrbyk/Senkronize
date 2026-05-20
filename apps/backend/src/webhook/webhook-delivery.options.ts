import type { JobOptions } from 'bull';

/** Giden webhook yeniden deneme gecikmeleri: 5 dk → 30 dk → 2 sa → 24 sa */
export const WEBHOOK_DELIVERY_RETRY_DELAYS_MS = [
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  24 * 60 * 60_000,
] as const;

export const WEBHOOK_DELIVERY_MAX_ATTEMPTS = 5;

/** Bull özel backoff stratejisi adı — `queue.module` içinde tanımlı */
export const WEBHOOK_DELIVERY_BACKOFF_TYPE = 'webhookDelivery';

/** Giden webhook teslimatı — ilk deneme anında, sonra sabit gecikmeler */
export const WEBHOOK_DELIVERY_JOB_OPTIONS: JobOptions = {
  attempts: WEBHOOK_DELIVERY_MAX_ATTEMPTS,
  backoff: { type: WEBHOOK_DELIVERY_BACKOFF_TYPE },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export const WEBHOOK_DELIVERY_TIMEOUT_MS = 10_000;

/** Ardışık başarısız teslimat sonrası uç nokta devre dışı */
export const WEBHOOK_CIRCUIT_BREAKER_THRESHOLD = 5;
