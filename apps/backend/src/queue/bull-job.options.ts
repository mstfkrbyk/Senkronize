import type { JobOptions } from 'bull';

import { JOB_PRIORITY, type JobPriority } from './queue-job-priority';

const BASE_QUEUE_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
} as const satisfies Omit<JobOptions, 'priority'>;

function queueJobOptions(priority: JobPriority): JobOptions {
  return { ...BASE_QUEUE_JOB_OPTIONS, priority };
}

/** BullMQ / bull kuyruk işi — kurallarla uyumlu varsayılan seçenekler */
export const STANDARD_QUEUE_JOB_OPTIONS: JobOptions = queueJobOptions(
  JOB_PRIORITY.NORMAL,
);

/** Sipariş sync — yüksek öncelik */
export const URGENT_QUEUE_JOB_OPTIONS: JobOptions = queueJobOptions(
  JOB_PRIORITY.URGENT,
);

/** Listeleme sync — normal öncelik */
export const NORMAL_QUEUE_JOB_OPTIONS: JobOptions = STANDARD_QUEUE_JOB_OPTIONS;

/** Rapor / düşük öncelikli işler */
export const LOW_QUEUE_JOB_OPTIONS: JobOptions = queueJobOptions(JOB_PRIORITY.LOW);
