import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { api } from '@/lib/api';
import type {
  PlatformReportData,
  ReportFilters,
  SalesReportData,
  TopProduct,
} from '@/types/report';

export interface SalesReportQueryState {
  kind: 'api' | 'mock' | 'placeholder';
  rows: SalesReportData[];
}

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

export function useSalesReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'sales', filters],
    queryFn: async (): Promise<SalesReportQueryState> => {
      try {
        const { data } = await api.get<SalesReportData[]>('/reports/sales', {
          params: filters,
        });
        return { kind: 'api', rows: data };
      } catch (error) {
        if (isAxiosError(error)) {
          return { kind: 'mock', rows: generateMockSalesData(30) };
        }
        throw error;
      }
    },
    placeholderData: {
      kind: 'placeholder',
      rows: generateMockSalesData(30),
    },
  });
}

export function usePlatformReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'platform', filters],
    queryFn: async (): Promise<PlatformReportData[]> => {
      try {
        const { data } = await api.get<PlatformReportData[]>('/reports/platform', {
          params: filters,
        });
        return data;
      } catch (error) {
        if (isAxiosError(error)) {
          return [];
        }
        throw error;
      }
    },
  });
}

export function useTopProducts(limit = 20) {
  return useQuery({
    queryKey: ['reports', 'products', limit],
    queryFn: async (): Promise<TopProduct[]> => {
      try {
        const { data } = await api.get<TopProduct[]>('/reports/products', {
          params: { limit },
        });
        return data;
      } catch (error) {
        if (isAxiosError(error)) {
          return [];
        }
        throw error;
      }
    },
  });
}
