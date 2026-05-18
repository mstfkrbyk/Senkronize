import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { UsageStats } from '@/types/subscription';

export function useSubscriptionUsage(enabled: boolean) {
  return useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: async (): Promise<UsageStats> => {
      const { data } = await api.get<UsageStats>('/subscriptions/usage');
      return data;
    },
    enabled,
  });
}
