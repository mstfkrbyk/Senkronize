import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { ReportFilters, SalesReportData } from '@/types/report';

function generateMockSalesData(days: number): SalesReportData[] {
  let seed = 2_147_483_647;
  const rnd = (): number => {
    seed = (seed * 48271) % 2_147_483_647;
    return (seed & 0xffff) / 0xffff;
  };
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - i - 1));
    return {
      period: date.toISOString().split('T')[0],
      totalOrders: Math.floor(rnd() * 30) + 5,
      totalRevenue: Math.floor(rnd() * 10000) + 1000,
      byPlatform: {
        TRENDYOL: Math.floor(rnd() * 20),
        HEPSIBURADA: Math.floor(rnd() * 10),
      },
    };
  });
}

const MOCK_SALES_DATA = generateMockSalesData(30);

export function useSalesReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'sales', filters],
    queryFn: async (): Promise<SalesReportData[]> => {
      const { data } = await api.get<SalesReportData[]>('/reports/sales', {
        params: filters,
      });
      return data;
    },
    initialData: MOCK_SALES_DATA,
    enabled: false,
  });
}
