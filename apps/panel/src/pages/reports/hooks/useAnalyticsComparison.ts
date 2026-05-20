import { useQuery } from '@tanstack/react-query';
import {
  differenceInCalendarDays,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from 'date-fns';

import { api } from '@/lib/api';
import type {
  AnalyticsComparisonResponse,
  ComparisonMetricTriple,
} from '@/types/analytics';
import type { PlatformComparisonData } from '@/types/report';

export type AnalyticsPeriodPreset = 'month' | 'quarter' | 'year';

export function periodDaysFromPreset(preset: AnalyticsPeriodPreset): number {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  let start: Date;
  if (preset === 'quarter') {
    start = startOfQuarter(today);
  } else if (preset === 'year') {
    start = startOfYear(today);
  } else {
    start = startOfMonth(today);
  }
  start.setHours(0, 0, 0, 0);
  return Math.max(1, differenceInCalendarDays(today, start) + 1);
}

function periodDateRange(preset: AnalyticsPeriodPreset): { start: string; end: string } {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  let from: Date;
  if (preset === 'quarter') {
    from = startOfQuarter(today);
  } else if (preset === 'year') {
    from = startOfYear(today);
  } else {
    from = startOfMonth(today);
  }
  return { start: from.toISOString().slice(0, 10), end };
}

function shiftRange(
  start: string,
  end: string,
  direction: 'previous' | 'yearAgo',
): { start: string; end: string } {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  const spanMs = e.getTime() - s.getTime();
  if (direction === 'previous') {
    const prevEnd = new Date(s.getTime() - 24 * 60 * 60 * 1000);
    const prevStart = new Date(prevEnd.getTime() - spanMs);
    return {
      start: prevStart.toISOString().slice(0, 10),
      end: prevEnd.toISOString().slice(0, 10),
    };
  }
  const yearEnd = new Date(e);
  yearEnd.setFullYear(yearEnd.getFullYear() - 1);
  const yearStart = new Date(yearEnd.getTime() - spanMs);
  return {
    start: yearStart.toISOString().slice(0, 10),
    end: yearEnd.toISOString().slice(0, 10),
  };
}

function weightedReturnRate(data: PlatformComparisonData | undefined): number {
  const platforms = data?.platforms ?? [];
  const totalOrders = platforms.reduce((s, p) => s + p.orderCount, 0);
  if (totalOrders <= 0) {
    return 0;
  }
  const weighted = platforms.reduce(
    (s, p) => s + p.returnRate * p.orderCount,
    0,
  );
  return Math.round((weighted / totalOrders) * 10) / 10;
}

function comparisonTriple(
  current: number,
  previous: number,
  yearAgo: number,
): ComparisonMetricTriple {
  const changeVsPrevious =
    previous !== 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : 0;
  const changeVsYearAgo =
    yearAgo !== 0 ? Math.round(((current - yearAgo) / yearAgo) * 1000) / 10 : 0;
  return { current, previous, yearAgo, changeVsPrevious, changeVsYearAgo };
}

export interface ExtendedComparisonMetrics {
  productSales: ComparisonMetricTriple;
  returnRate: ComparisonMetricTriple;
}

export function useAnalyticsComparison(preset: AnalyticsPeriodPreset) {
  const periodDays = periodDaysFromPreset(preset);
  const { start, end } = periodDateRange(preset);
  const prevRange = shiftRange(start, end, 'previous');
  const yearRange = shiftRange(start, end, 'yearAgo');

  const comparisonQuery = useQuery({
    queryKey: ['analytics', 'comparison', preset, periodDays],
    queryFn: async (): Promise<AnalyticsComparisonResponse> => {
      const { data } = await api.get<AnalyticsComparisonResponse>(
        '/analytics/comparison',
        { params: { period: String(periodDays) } },
      );
      return data;
    },
    staleTime: 120_000,
  });

  const returnCurrentQuery = useQuery({
    queryKey: ['reports', 'platform-comparison', 'analytics', preset, 'current'],
    queryFn: async (): Promise<PlatformComparisonData> => {
      const { data } = await api.get<PlatformComparisonData>(
        '/reports/platform-comparison',
        { params: { startDate: start, endDate: end } },
      );
      return data;
    },
    staleTime: 120_000,
  });

  const returnPrevQuery = useQuery({
    queryKey: ['reports', 'platform-comparison', 'analytics', preset, 'prev'],
    queryFn: async (): Promise<PlatformComparisonData> => {
      const { data } = await api.get<PlatformComparisonData>(
        '/reports/platform-comparison',
        {
          params: {
            startDate: prevRange.start,
            endDate: prevRange.end,
          },
        },
      );
      return data;
    },
    staleTime: 120_000,
  });

  const returnYearQuery = useQuery({
    queryKey: ['reports', 'platform-comparison', 'analytics', preset, 'year'],
    queryFn: async (): Promise<PlatformComparisonData> => {
      const { data } = await api.get<PlatformComparisonData>(
        '/reports/platform-comparison',
        {
          params: {
            startDate: yearRange.start,
            endDate: yearRange.end,
          },
        },
      );
      return data;
    },
    staleTime: 120_000,
  });

  const extendedMetrics: ExtendedComparisonMetrics | undefined =
    comparisonQuery.data
      ? {
          productSales: comparisonTriple(
            comparisonQuery.data.categories.reduce(
              (s, c) => s + c.orders.current,
              0,
            ),
            comparisonQuery.data.categories.reduce(
              (s, c) => s + c.orders.previous,
              0,
            ),
            comparisonQuery.data.categories.reduce(
              (s, c) => s + c.orders.yearAgo,
              0,
            ),
          ),
          returnRate: comparisonTriple(
            weightedReturnRate(returnCurrentQuery.data),
            weightedReturnRate(returnPrevQuery.data),
            weightedReturnRate(returnYearQuery.data),
          ),
        }
      : undefined;

  return {
    comparisonQuery,
    extendedMetrics,
    periodDays,
    isLoading:
      comparisonQuery.isLoading ||
      returnCurrentQuery.isLoading ||
      returnPrevQuery.isLoading ||
      returnYearQuery.isLoading,
  };
}

export function presetLabel(preset: AnalyticsPeriodPreset): string {
  if (preset === 'quarter') {
    return 'Bu çeyrek';
  }
  if (preset === 'year') {
    return 'Bu yıl';
  }
  return 'Bu ay';
}
