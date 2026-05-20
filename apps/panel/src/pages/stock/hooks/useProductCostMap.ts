import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { ProductListItem } from '@/types/product';

function parseCost(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function useProductCostMap() {
  return useQuery({
    queryKey: ['products', 'cost-map'],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data } = await api.get<{ items: ProductListItem[]; total: number }>(
        '/products',
        { params: { page: 1, limit: 500 } },
      );
      const map = new Map<string, number>();
      for (const p of data.items) {
        if (p.barcode) {
          map.set(p.barcode, parseCost(p.costPrice));
        }
      }
      return map;
    },
    staleTime: 120_000,
  });
}
