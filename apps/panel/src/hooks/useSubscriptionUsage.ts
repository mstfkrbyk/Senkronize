import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { UsageOverview } from '@/types/subscription';

export function useSubscriptionUsage(enabled: boolean) {
  return useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: async (): Promise<UsageOverview> => {
      const { data } = await api.get<UsageOverview>('/subscriptions/usage');
      return data;
    },
    enabled,
  });
}
