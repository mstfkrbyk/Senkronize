/** `GET /accounting/inventory-valuation?warehouseId=` */
export interface AccountingInventoryValuation {
  warehouseId: string | null;
  totalQuantity: number;
  totalValue: string;
  skuCount: number;
  currency: string;
}

export interface AccountingInventoryValuationResponse {
  data: AccountingInventoryValuation;
}

export function parseAccountingInventoryTotalValue(
  raw: string | null | undefined,
): number {
  if (raw == null || raw === '') {
    return 0;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}
