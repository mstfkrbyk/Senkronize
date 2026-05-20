/** Pazaryeri sipariş upsert / pull işleme batch boyutu */
export const MARKETPLACE_ORDER_BATCH_SIZE = 50;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Redis baskısına göre worker eşzamanlılığı (QUEUE_*_CONCURRENCY env ile override).
 */
export const QUEUE_WORKER_CONCURRENCY = {
  marketplacePull: parsePositiveInt(process.env.QUEUE_PULL_CONCURRENCY, 2),
  marketplacePush: parsePositiveInt(process.env.QUEUE_PUSH_CONCURRENCY, 4),
  listingSync: parsePositiveInt(process.env.QUEUE_LISTING_SYNC_CONCURRENCY, 3),
  erpSync: parsePositiveInt(process.env.QUEUE_ERP_SYNC_CONCURRENCY, 2),
  pricing: parsePositiveInt(process.env.QUEUE_PRICING_CONCURRENCY, 2),
  notification: parsePositiveInt(process.env.QUEUE_NOTIFICATION_CONCURRENCY, 5),
  dataImport: parsePositiveInt(process.env.QUEUE_DATA_IMPORT_CONCURRENCY, 2),
} as const;
