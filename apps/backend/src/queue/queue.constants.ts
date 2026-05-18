import type { JobOptions } from 'bull';

export const QUEUE_MARKETPLACE_PULL = 'marketplace-pull';
export const QUEUE_MARKETPLACE_PUSH = 'marketplace-push';
export const QUEUE_ERP_SYNC = 'erp-sync';
export const QUEUE_NOTIFICATION = 'notification-dispatch';
export const QUEUE_PRICING = 'pricing-engine';
export const QUEUE_IMAGE = 'image-upload';
/** Pazaryeri görsel URL → R2 buffer yükleme (axios) */
export const QUEUE_IMAGE_SYNC = 'image-sync';
/** Giden müşteri webhook teslimatı (HTTP POST + imza) */
export const QUEUE_WEBHOOK_DELIVERY = 'webhook-delivery';

/** Pazaryeri pull/push ve benzeri dış API işleri — Bull job varsayılanları */
export const JOB_DEFAULT_OPTIONS: JobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};
