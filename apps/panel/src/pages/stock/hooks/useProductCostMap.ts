import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { parseProductCost } from '@/lib/product-cost';
import type { ProductListItem } from '@/types/product';

export function useProductCostMap(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['products', 'cost-map'],
    enabled: options?.enabled !== false,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data } = await api.get<{ items: ProductListItem[]; total: number }>(
        '/products',
        { params: { page: 1, limit: 500 } },
      );
      const map = new Map<string, number>();
      for (const p of data.items) {
        if (p.barcode) {
          map.set(p.barcode, parseProductCost(p.costPrice));
        }
      }
      return map;
    },
    staleTime: 120_000,
  });
}
