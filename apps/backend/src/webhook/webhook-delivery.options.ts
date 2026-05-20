import type { JobOptions } from 'bull';

/** Giden webhook teslimatı — 5 deneme, 1dk üstel backoff (1→2→4→8→16 dk) */
export const WEBHOOK_DELIVERY_JOB_OPTIONS: JobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export const WEBHOOK_DELIVERY_TIMEOUT_MS = 10_000;
