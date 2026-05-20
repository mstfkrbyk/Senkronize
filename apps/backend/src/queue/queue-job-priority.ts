/** Bull kuyruk önceliği — düşük sayı = daha yüksek öncelik. */
export const JOB_PRIORITY = {
  URGENT: 1,
  NORMAL: 5,
  LOW: 10,
} as const;

export type JobPriority = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY];
