import { useQuery } from '@tanstack/react-query';

import { useDashboardPeriod } from '@/hooks/useDashboardPeriod';
import { api } from '@/lib/api';
import type {
  DashboardApiSummary,
  DashboardKpisResponse,
} from '@/types/dashboard-widgets';

export interface DashboardStats {
  summary: DashboardApiSummary;
  kpis: DashboardKpisResponse;
}

export function useDashboardStats(): {
  data: DashboardStats | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { api: periodApi } = useDashboardPeriod();

  const query = useQuery({
    queryKey: ['dashboard', 'stats', periodApi.queryKey],
    queryFn: async (): Promise<DashboardStats> => {
      const [summaryRes, kpisRes] = await Promise.all([
        api.get<DashboardApiSummary>('/dashboard/summary', {
          params: { period: periodApi.summaryPeriod },
        }),
        api.get<DashboardKpisResponse>('/dashboard/kpis', {
          params: { period: periodApi.kpiPeriod },
        }),
      ]);
      return { summary: summaryRes.data, kpis: kpisRes.data };
    },
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data,
    isLoading: query.isPending,
    isError: query.isError,
  };
}
