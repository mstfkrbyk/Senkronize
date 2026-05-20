export type StockLevelStatus = 'NORMAL' | 'LOW' | 'CRITICAL' | 'OUT';

export const STOCK_LEVEL_LABELS: Record<StockLevelStatus, string> = {
  NORMAL: 'Normal',
  LOW: 'Düşük',
  CRITICAL: 'Kritik',
  OUT: 'Tükendi',
};

export function getStockLevelStatus(
  available: number,
  reorderPoint: number | null | undefined,
  lowStock: boolean,
): StockLevelStatus {
  if (available <= 0) {
    return 'OUT';
  }
  if (
    reorderPoint !== null &&
    reorderPoint !== undefined &&
    available <= Math.max(1, Math.floor(reorderPoint * 0.5))
  ) {
    return 'CRITICAL';
  }
  if (
    lowStock ||
    (reorderPoint !== null &&
      reorderPoint !== undefined &&
      available <= reorderPoint)
  ) {
    return 'LOW';
  }
  return 'NORMAL';
}

export function stockLevelBadgeClass(status: StockLevelStatus): string {
  switch (status) {
    case 'OUT':
      return 'bg-red-600 text-white hover:bg-red-600';
    case 'CRITICAL':
      return 'bg-red-100 text-red-900 hover:bg-red-100';
    case 'LOW':
      return 'bg-amber-100 text-amber-900 hover:bg-amber-100';
    default:
      return 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100';
  }
}
