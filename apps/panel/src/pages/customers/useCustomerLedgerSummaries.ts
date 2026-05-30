import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export interface CustomerLedgerSummary {
  debit: string;
  credit: string;
  balance: string;
  currency: string;
}

export type CustomerLedgerSummariesMap = Record<string, CustomerLedgerSummary>;

export function useCustomerLedgerSummaries(
  customerIds: string[],
  enabled: boolean,
): ReturnType<typeof useQuery<CustomerLedgerSummariesMap>> {
  const idsKey = customerIds.slice().sort().join(',');

  return useQuery({
    queryKey: ['customer-ledger-summaries', idsKey],
    enabled: enabled && customerIds.length > 0,
    queryFn: async (): Promise<CustomerLedgerSummariesMap> => {
      const { data } = await api.get<{ data: CustomerLedgerSummariesMap }>(
        '/accounting/customers/ledger-summaries',
        { params: { ids: customerIds.join(',') } },
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}
