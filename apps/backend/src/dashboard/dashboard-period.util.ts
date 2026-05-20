import {
  parsePeriodDays,
  rangeForDays,
  rangeWithPrevious,
  type AnalyticsPreviousRange,
} from '../analytics/analytics-period.util';

export type DashboardPeriod = '7d' | '30d' | '90d';

const ALLOWED: DashboardPeriod[] = ['7d', '30d', '90d'];

export function parseDashboardPeriod(
  period: string | undefined,
  fallback: DashboardPeriod = '30d',
): DashboardPeriod {
  const days = parsePeriodDays(period, parsePeriodDays(fallback, 30));
  if (days <= 7) {
    return '7d';
  }
  if (days <= 30) {
    return '30d';
  }
  return '90d';
}

export function dashboardPeriodDays(period: DashboardPeriod): number {
  if (period === '7d') {
    return 7;
  }
  if (period === '90d') {
    return 90;
  }
  return 30;
}

export function dashboardRanges(period: DashboardPeriod): AnalyticsPreviousRange {
  return rangeWithPrevious(dashboardPeriodDays(period));
}

export function dashboardCurrentRange(period: DashboardPeriod) {
  return rangeForDays(dashboardPeriodDays(period));
}

export function pctChangeRounded(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 10) / 10;
}

export function isAllowedDashboardPeriod(
  value: string,
): value is DashboardPeriod {
  return (ALLOWED as string[]).includes(value);
}
