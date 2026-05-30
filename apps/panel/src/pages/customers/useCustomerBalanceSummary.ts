import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { CustomersBalanceSummary } from '@/pages/customers/customers-balance-summary.types';

export function useCustomerBalanceSummary(
  enabled: boolean,
): ReturnType<typeof useQuery<CustomersBalanceSummary>> {
  return useQuery({
    queryKey: ['accounting', 'customers', 'balance-summary'],
    enabled,
    queryFn: async (): Promise<CustomersBalanceSummary> => {
      const { data } = await api.get<{ data: CustomersBalanceSummary }>(
        '/accounting/customers/balance-summary',
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}
