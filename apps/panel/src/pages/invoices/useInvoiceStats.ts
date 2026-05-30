import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { InvoiceStatsDto } from '@/types/invoice';

export function useInvoiceStats(enabled = true): UseQueryResult<InvoiceStatsDto> {
  return useQuery({
    queryKey: ['invoices', 'stats'],
    queryFn: async (): Promise<InvoiceStatsDto> => {
      const { data } = await api.get<{ data: InvoiceStatsDto }>('/invoices/stats');
      return data.data;
    },
    enabled,
  });
}
