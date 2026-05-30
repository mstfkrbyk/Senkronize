import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '@/lib/api';

import type {
  AccountingVatSummary,
  AccountingVatSummaryResponse,
} from '../accounting-vat-summary.types';

interface Args {
  month: string;
  enabled?: boolean;
}

export function useAccountingVatSummary({
  month,
  enabled = true,
}: Args): UseQueryResult<AccountingVatSummary> {
  return useQuery({
    queryKey: ['accounting', 'vat-summary', month],
    queryFn: async (): Promise<AccountingVatSummary> => {
      const { data } = await api.get<AccountingVatSummaryResponse>(
        '/accounting/vat-summary',
        { params: { month } },
      );
      return data.data;
    },
    enabled: enabled && /^\d{4}-\d{2}$/.test(month),
  });
}
