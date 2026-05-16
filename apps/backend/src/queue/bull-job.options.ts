import type { JobOptions } from 'bull';

/** BullMQ / bull kuyruk işi — kurallarla uyumlu varsayılan seçenekler */
export const STANDARD_QUEUE_JOB_OPTIONS: JobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};
