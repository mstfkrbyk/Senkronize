/** Platform başına listing sync toplu güncelleme üst sınırı. */
export const LISTING_SYNC_BATCH_LIMITS: Record<string, number> = {
  TRENDYOL: 100,
  HEPSIBURADA: 500,
  N11: 50,
  TICIMAX: 100,
  DEFAULT: 50,
};

export function getListingSyncBatchLimit(platform: string): number {
  const key = platform.toUpperCase();
  return LISTING_SYNC_BATCH_LIMITS[key] ?? LISTING_SYNC_BATCH_LIMITS.DEFAULT;
}
