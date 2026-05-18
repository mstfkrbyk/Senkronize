import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Payment, PaymentsPage } from '@/types/subscription';

export function useInvoices(enabled: boolean) {
  return useQuery({
    queryKey: ['subscription', 'invoices'],
    queryFn: async (): Promise<{ items: Payment[]; total: number }> => {
      const { data } = await api.get<PaymentsPage>('/subscriptions/invoices', {
        params: { page: 1, limit: 50 },
      });
      return { items: data.items, total: data.total };
    },
    enabled,
  });
}
