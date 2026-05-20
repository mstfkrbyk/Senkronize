import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { StockListResponse } from '@/types/stock';

export interface ProductByBarcodeResult {
  id: string;
  barcode: string;
  name: string;
  sku: string | null;
  systemQty: number;
}

export async function fetchProductByBarcode(
  barcode: string,
  warehouseId?: string,
): Promise<ProductByBarcodeResult | null> {
  const trimmed = barcode.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const { data: body } = await api.get<{
      data: {
        id: string;
        barcode: string;
        name: string;
        sku: string | null;
      } | null;
    }>('/products/barcode/search', { params: { barcode: trimmed } });
    const product = body.data;
    if (!product) {
      throw new Error('not found');
    }
    const stockRes = await api.get<StockListResponse>('/stock', {
      params: { search: trimmed, limit: 5, page: 1, warehouseId },
    });
    const stockRow =
      stockRes.data.items.find((i) => i.barcode === trimmed) ??
      stockRes.data.items[0];
    return {
      id: product.id,
      barcode: product.barcode,
      name: product.name,
      sku: product.sku,
      systemQty: stockRow?.quantity ?? 0,
    };
  } catch {
    const { data } = await api.get<StockListResponse>('/stock', {
      params: { search: trimmed, limit: 5, page: 1, warehouseId },
    });
    const match =
      data.items.find((i) => i.barcode === trimmed) ?? data.items[0];
    if (!match) {
      return null;
    }
    return {
      id: match.product?.id ?? '',
      barcode: match.barcode,
      name: match.product?.name ?? match.barcode,
      sku: match.product?.sku ?? null,
      systemQty: match.quantity,
    };
  }
}

export function useProductByBarcode(
  barcode: string | undefined,
  warehouseId?: string,
) {
  return useQuery({
    queryKey: ['products', 'barcode', barcode, warehouseId],
    queryFn: async (): Promise<ProductByBarcodeResult | null> =>
      fetchProductByBarcode(barcode ?? '', warehouseId),
    enabled: typeof barcode === 'string' && barcode.trim().length > 0,
    staleTime: 10_000,
  });
}
