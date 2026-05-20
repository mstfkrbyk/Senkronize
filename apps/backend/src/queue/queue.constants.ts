import type { JobOptions } from 'bull';

import { JOB_PRIORITY } from './queue-job-priority';

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
/** Ürün → platform listing stok/fiyat push */
export const QUEUE_LISTING_SYNC = 'listing-sync';
/** Veri taşıma sihirbazı toplu içe aktarma */
export const QUEUE_DATA_IMPORT = 'data-import';

/** Pazaryeri pull/push ve benzeri dış API işleri — Bull job varsayılanları */
export const JOB_DEFAULT_OPTIONS: JobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 50,
  priority: JOB_PRIORITY.NORMAL,
};

/** Sipariş pull — yüksek öncelik */
export const JOB_PULL_ORDERS_OPTIONS: JobOptions = {
  ...JOB_DEFAULT_OPTIONS,
  priority: JOB_PRIORITY.URGENT,
};

/** listing-sync kuyruğu — stok/fiyat push */
export const LISTING_SYNC_JOB_OPTIONS: JobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 50,
  priority: JOB_PRIORITY.NORMAL,
};

export const LISTING_SYNC_STOCK_JOB_OPTIONS: JobOptions = {
  ...LISTING_SYNC_JOB_OPTIONS,
  priority: JOB_PRIORITY.NORMAL,
};
