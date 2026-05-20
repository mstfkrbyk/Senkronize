export const QUICK_STOCK_ADJUST_EVENT = 'senkronize-open-quick-stock-adjust';

export interface QuickStockAdjustDetail {
  barcode?: string;
  productName?: string;
  currentQty?: number;
}

export function openQuickStockAdjust(detail?: QuickStockAdjustDetail): void {
  window.dispatchEvent(
    new CustomEvent<QuickStockAdjustDetail>(QUICK_STOCK_ADJUST_EVENT, {
      detail,
    }),
  );
}
