import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { parseProductCost } from '@/lib/product-cost';
import type { ProductListItem } from '@/types/product';

export interface ProductCostRow {
  barcode: string;
  costPrice: number;
}

export function useProducts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['products', 'cost-rows'],
    queryFn: async (): Promise<ProductCostRow[]> => {
      const { data } = await api.get<{ items: ProductListItem[]; total: number }>(
        '/products',
        { params: { page: 1, limit: 500 } },
      );
      return data.items
        .filter((p) => Boolean(p.barcode))
        .map((p) => ({
          barcode: p.barcode,
          costPrice: parseProductCost(p.costPrice),
        }));
    },
    enabled: options?.enabled ?? true,
    staleTime: 120_000,
  });
}
