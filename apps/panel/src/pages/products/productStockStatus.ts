export type ProductStockStatusFilter = 'all' | 'low' | 'out' | 'ok';

export function stockStatusFromQuantity(qty: number): 'out' | 'low' | 'ok' {
  const q = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
  if (q === 0) {
    return 'out';
  }
  if (q <= 20) {
    return 'low';
  }
  return 'ok';
}

export function stockStatusToApiRange(
  status: ProductStockStatusFilter,
): { minStock?: number; maxStock?: number } {
  switch (status) {
    case 'out':
      return { minStock: 0, maxStock: 0 };
    case 'low':
      return { minStock: 1, maxStock: 20 };
    case 'ok':
      return { minStock: 21 };
    case 'all':
    default:
      return {};
  }
}
