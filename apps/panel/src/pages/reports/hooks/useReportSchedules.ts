import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { ReportScheduleItem } from '@/types/report';

export function useReportSchedules(): ReturnType<
  typeof useQuery<ReportScheduleItem[], Error>
> {
  return useQuery({
    queryKey: ['reports', 'schedules'],
    queryFn: async (): Promise<ReportScheduleItem[]> => {
      const { data } = await api.get<ReportScheduleItem[]>('/reports/schedules');
      return data;
    },
  });
}
