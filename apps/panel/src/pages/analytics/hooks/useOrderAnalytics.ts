import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  AovTrendResponse,
  CustomerInsightsResponse,
  DailyRevenueTrendResponse,
  PlatformComparisonResponse,
  RevenueByHourResponse,
  TopProductsResponse,
  TopReturnedProductsResponse,
} from '@/types/analytics';

const STALE = 120_000;

export function usePlatformComparison(period = '30d') {
  return useQuery({
    queryKey: ['analytics', 'platform-comparison', period],
    queryFn: async (): Promise<PlatformComparisonResponse> => {
      const { data } = await api.get<PlatformComparisonResponse>(
        '/analytics/platform-comparison',
        { params: { period } },
      );
      return data;
    },
    staleTime: STALE,
  });
}

export function useCustomerInsights(period = '30d') {
  return useQuery({
    queryKey: ['analytics', 'customer-insights', period],
    queryFn: async (): Promise<CustomerInsightsResponse> => {
      const { data } = await api.get<CustomerInsightsResponse>(
        '/analytics/customer-insights',
        { params: { period } },
      );
      return data;
    },
    staleTime: STALE,
  });
}

export function useRevenueByHour(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'revenue-by-hour', days],
    queryFn: async (): Promise<RevenueByHourResponse> => {
      const { data } = await api.get<RevenueByHourResponse>(
        '/analytics/revenue-by-hour',
        { params: { days } },
      );
      return data;
    },
    staleTime: STALE,
  });
}

export function useTopProducts(period = '30d', limit = 10) {
  return useQuery({
    queryKey: ['analytics', 'top-products', period, limit],
    queryFn: async (): Promise<TopProductsResponse> => {
      const { data } = await api.get<TopProductsResponse>(
        '/analytics/top-products',
        { params: { period, limit } },
      );
      return data;
    },
    staleTime: STALE,
  });
}

export function useTopReturnedProducts(period = '30d', limit = 10) {
  return useQuery({
    queryKey: ['analytics', 'top-returned-products', period, limit],
    queryFn: async (): Promise<TopReturnedProductsResponse> => {
      const { data } = await api.get<TopReturnedProductsResponse>(
        '/analytics/top-returned-products',
        { params: { period, limit } },
      );
      return data;
    },
    staleTime: STALE,
  });
}

export function useAovTrend(days = 90) {
  return useQuery({
    queryKey: ['analytics', 'aov-trend', days],
    queryFn: async (): Promise<AovTrendResponse> => {
      const { data } = await api.get<AovTrendResponse>('/analytics/aov-trend', {
        params: { days },
      });
      return data;
    },
    staleTime: STALE,
  });
}

export function useDailyRevenueTrend(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'daily-revenue-trend', days],
    queryFn: async (): Promise<DailyRevenueTrendResponse> => {
      const { data } = await api.get<DailyRevenueTrendResponse>(
        '/analytics/daily-revenue-trend',
        { params: { days } },
      );
      return data;
    },
    staleTime: STALE,
  });
}
