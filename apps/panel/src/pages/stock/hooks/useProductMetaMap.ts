import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { ProductListItem } from '@/types/product';

export interface ProductMeta {
  productId: string;
  imageUrl: string | null;
  reorderPoint: number | null;
  reorderQty: number | null;
}

function parseOptionalInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function useProductMetaMap() {
  return useQuery({
    queryKey: ['products', 'meta-map'],
    queryFn: async (): Promise<Map<string, ProductMeta>> => {
      const { data } = await api.get<{ items: ProductListItem[]; total: number }>(
        '/products',
        { params: { page: 1, limit: 500 } },
      );
      const map = new Map<string, ProductMeta>();
      for (const p of data.items) {
        if (!p.barcode) {
          continue;
        }
        map.set(p.barcode, {
          productId: p.id,
          imageUrl: p.imageUrls[0] ?? null,
          reorderPoint: parseOptionalInt(p.reorderPoint),
          reorderQty: parseOptionalInt(p.reorderQty),
        });
      }
      return map;
    },
    staleTime: 120_000,
  });
}
