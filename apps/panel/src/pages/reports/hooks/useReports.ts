import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { api } from '@/lib/api';
import type {
  OrderTrendData,
  PlatformComparisonData,
  PlatformReportData,
  ProfitReportData,
  ReportFilters,
  SalesReportData,
  StockValueReportData,
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

function normalizePlatformRow(
  row: {
    platform: string;
    orderCount?: number;
    revenue?: number;
    totalOrders?: number;
    totalRevenue?: number;
  },
  totalRevenueAll: number,
): PlatformReportData {
  const totalOrders = row.orderCount ?? row.totalOrders ?? 0;
  const totalRevenue = row.revenue ?? row.totalRevenue ?? 0;
  const percentage =
    totalRevenueAll > 0 ? (totalRevenue / totalRevenueAll) * 100 : 0;
  return {
    platform: row.platform,
    totalOrders,
    totalRevenue,
    percentage,
  };
}

export function useSalesReport(
  filters: ReportFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['reports', 'sales', filters],
    enabled: options?.enabled ?? true,
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
        const { data } = await api.get<
          {
            platform: string;
            orderCount?: number;
            revenue?: number;
            totalOrders?: number;
            totalRevenue?: number;
          }[]
        >('/reports/platform', {
          params: filters,
        });
        const totalRev = data.reduce(
          (s, r) => s + (r.revenue ?? r.totalRevenue ?? 0),
          0,
        );
        return data.map((r) => normalizePlatformRow(r, totalRev));
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

export interface ProfitReportFilters {
  startDate: string;
  endDate: string;
  platform?: string;
}

export function useProfitReport(
  filters: ProfitReportFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['reports', 'profit', filters],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<ProfitReportData> => {
      const { data } = await api.get<ProfitReportData>('/reports/profit', {
        params: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          ...(filters.platform && filters.platform !== 'all'
            ? { platform: filters.platform }
            : {}),
        },
      });
      return data;
    },
  });
}

export function useStockValueReport(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['reports', 'stock-value'],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<StockValueReportData> => {
      const { data } = await api.get<StockValueReportData>('/reports/stock-value');
      return data;
    },
  });
}

export interface OrderTrendFilters {
  startDate: string;
  endDate: string;
  granularity: 'daily' | 'weekly' | 'monthly';
}

export function useOrderTrend(
  filters: OrderTrendFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['reports', 'order-trend', filters],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<OrderTrendData> => {
      const { data } = await api.get<OrderTrendData>('/reports/order-trend', {
        params: filters,
      });
      return data;
    },
  });
}

export interface PlatformComparisonFilters {
  startDate: string;
  endDate: string;
}

export function usePlatformComparison(
  filters: PlatformComparisonFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['reports', 'platform-comparison', filters],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<PlatformComparisonData> => {
      const { data } = await api.get<PlatformComparisonData>(
        '/reports/platform-comparison',
        { params: filters },
      );
      return data;
    },
  });
}
