import { useQuery } from '@tanstack/react-query';

import { api, getApiErrorMessage } from '@/lib/api';
import type { VatReport } from '@/types/vat-report';

interface Args {
  year: number;
  month: number;
  enabled?: boolean;
}

export function useVatReport({ year, month, enabled = true }: Args) {
  return useQuery({
    queryKey: ['reports', 'vat', year, month],
    queryFn: async (): Promise<VatReport> => {
      const { data } = await api.get<VatReport>('/reports/vat', {
        params: { year, month },
      });
      return data;
    },
    enabled,
  });
}

export function getVatReportErrorMessage(error: unknown): string {
  return getApiErrorMessage(error);
}
