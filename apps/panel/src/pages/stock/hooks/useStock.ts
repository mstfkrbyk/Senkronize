import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { StockEntry, StockFilters, StockListResponse } from '@/types/stock';

function buildStockParams(
  filters: StockFilters,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') {
      continue;
    }
    params[key] = value;
  }
  return params;
}

export function useStock(filters: StockFilters) {
  return useQuery({
    queryKey: ['stock', filters],
    queryFn: async (): Promise<StockListResponse> => {
      const { data } = await api.get<StockListResponse>('/stock', {
        params: buildStockParams(filters),
      });
      return data;
    },
  });
}

export function useLowStock(threshold = 10) {
  return useQuery({
    queryKey: ['stock', 'low-stock', threshold],
    queryFn: async (): Promise<StockEntry[]> => {
      const { data } = await api.get<StockEntry[]>('/stock/low-stock', {
        params: { threshold },
      });
      return data;
    },
    refetchInterval: 60_000,
  });
}
