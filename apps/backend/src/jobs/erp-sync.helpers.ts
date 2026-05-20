import type { ErpProduct, IErpAdapter } from '@senkronize/shared';
import { Prisma } from '@prisma/client';

export interface ErpStockCapableAdapter extends IErpAdapter {
  updateStock(
    credentials: Record<string, string>,
    productId: string,
    quantity: number,
    note?: string,
  ): Promise<void>;
}

export function isErpStockCapableAdapter(
  adapter: IErpAdapter,
): adapter is ErpStockCapableAdapter {
  return typeof (adapter as ErpStockCapableAdapter).updateStock === 'function';
}

export function buildErpProductMap(
  products: ErpProduct[],
): Map<string, ErpProduct> {
  const map = new Map<string, ErpProduct>();
  for (const product of products) {
    const barcode = product.barcode.trim();
    if (barcode.length > 0) {
      map.set(barcode, product);
    }
  }
  return map;
}

export function toDecimal(value: number | undefined): Prisma.Decimal | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return new Prisma.Decimal(value);
}
