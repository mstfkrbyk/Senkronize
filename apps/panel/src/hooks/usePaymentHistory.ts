import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Payment, PaymentsPage } from '@/types/subscription';

export function usePaymentHistory(enabled: boolean) {
  return useQuery({
    queryKey: ['subscription', 'payments'],
    queryFn: async (): Promise<{ items: Payment[]; total: number }> => {
      const { data } = await api.get<PaymentsPage>('/subscriptions/payments', {
        params: { page: 1, limit: 20 },
      });
      return { items: data.items, total: data.total };
    },
    enabled,
  });
}
