import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  OrderFilters,
  OrderSummaryDto,
  OrdersResponse,
} from '@/types/order';

function buildOrderParams(filters: OrderFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') {
      continue;
    }
    params[key] = value;
  }
  return params;
}

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async (): Promise<OrdersResponse> => {
      const { data } = await api.get<OrdersResponse>('/orders', {
        params: buildOrderParams(filters),
      });
      return data;
    },
  });
}

export function useOrderSummary() {
  return useQuery({
    queryKey: ['orders', 'summary'],
    queryFn: async (): Promise<OrderSummaryDto> => {
      const { data } = await api.get<OrderSummaryDto>('/orders/summary');
      return data;
    },
    staleTime: 60_000,
  });
}
