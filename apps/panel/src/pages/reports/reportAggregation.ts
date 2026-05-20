import { format, parseISO, startOfMonth, startOfWeek } from 'date-fns';

import type { SalesReportData } from '@/types/report';

function mergePlatforms(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function filterSalesByDateRange(
  rows: SalesReportData[],
  startDate?: string,
  endDate?: string,
): SalesReportData[] {
  return rows.filter((row) => {
    if (startDate && row.period < startDate) {
      return false;
    }
    if (endDate && row.period > endDate) {
      return false;
    }
    return true;
  });
}

export function aggregateSalesByGroup(
  rows: SalesReportData[],
  groupBy: 'day' | 'week' | 'month',
): SalesReportData[] {
  if (groupBy === 'day') {
    return [...rows].sort((a, b) => a.period.localeCompare(b.period));
  }

  const bucket = new Map<string, SalesReportData>();

  for (const row of rows) {
    const d = parseISO(`${row.period}T12:00:00`);
    let key: string;
    if (groupBy === 'week') {
      const wk = startOfWeek(d, { weekStartsOn: 1 });
      key = wk.toISOString().split('T')[0];
    } else {
      key = format(startOfMonth(d), 'yyyy-MM');
    }
    const existing = bucket.get(key);
    if (!existing) {
      bucket.set(key, {
        period: key,
        totalOrders: row.totalOrders,
        totalRevenue: row.totalRevenue,
        byPlatform: { ...row.byPlatform },
      });
    } else {
      existing.totalOrders += row.totalOrders;
      existing.totalRevenue += row.totalRevenue;
      existing.byPlatform = mergePlatforms(existing.byPlatform, row.byPlatform);
    }
  }

  return Array.from(bucket.values()).sort((a, b) => a.period.localeCompare(b.period));
}

export function filterSalesByPlatform(
  rows: SalesReportData[],
  platform?: string,
): SalesReportData[] {
  if (!platform) {
    return rows;
  }
  return filterSalesByPlatforms(rows, [platform]);
}

export function filterSalesByPlatforms(
  rows: SalesReportData[],
  platforms?: string[],
): SalesReportData[] {
  if (!platforms || platforms.length === 0) {
    return rows;
  }
  const set = new Set(platforms);
  return rows.map((row) => {
    const filtered: Record<string, number> = {};
    let totalOrders = 0;
    for (const [p, cnt] of Object.entries(row.byPlatform)) {
      if (set.has(p)) {
        filtered[p] = cnt;
        totalOrders += cnt;
      }
    }
    const denom = Object.values(row.byPlatform).reduce((s, n) => s + n, 0) || 1;
    const ratio = totalOrders / denom;
    return {
      ...row,
      totalOrders,
      totalRevenue: Math.round(row.totalRevenue * ratio),
      byPlatform: filtered,
    };
  });
}

export function buildStackedChartData(
  rows: SalesReportData[],
): Array<Record<string, string | number>> {
  const platforms = new Set<string>();
  for (const row of rows) {
    for (const p of Object.keys(row.byPlatform)) {
      platforms.add(p);
    }
  }
  return rows.map((row) => {
    const orderSum = sumPlatforms(row.byPlatform) || 1;
    const point: Record<string, string | number> = { period: row.period };
    for (const p of platforms) {
      const cnt = row.byPlatform[p] ?? 0;
      const share = cnt / orderSum;
      point[p] = Math.round(row.totalRevenue * share);
    }
    return point;
  });
}

export function buildSalesDetailRows(
  rows: SalesReportData[],
  returnRateByPlatform: Record<string, number> = {},
): Array<{
  period: string;
  platform: string;
  orders: number;
  revenue: number;
  returns: number;
  netRevenue: number;
}> {
  const out: Array<{
    period: string;
    platform: string;
    orders: number;
    revenue: number;
    returns: number;
    netRevenue: number;
  }> = [];
  for (const row of rows) {
    const orderSum = sumPlatforms(row.byPlatform) || 1;
    for (const [platform, cnt] of Object.entries(row.byPlatform)) {
      if (cnt <= 0) continue;
      const share = cnt / orderSum;
      const revenue = Math.round(row.totalRevenue * share);
      const rate = (returnRateByPlatform[platform] ?? 0) / 100;
      const returns = Math.round(revenue * rate);
      out.push({
        period: row.period,
        platform,
        orders: cnt,
        revenue,
        returns,
        netRevenue: revenue - returns,
      });
    }
  }
  return out.sort((a, b) =>
    a.period === b.period
      ? a.platform.localeCompare(b.platform)
      : a.period.localeCompare(b.period),
  );
}

function sumPlatforms(by: Record<string, number>): number {
  return Object.values(by).reduce((s, n) => s + n, 0);
}

/** Platform dağılımı için toplam gelir tahmini (mock veride oransal bölüşüm). */
export function platformRevenueShares(
  rows: SalesReportData[],
): Array<{ name: string; value: number }> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const orderSum = sumPlatforms(row.byPlatform);
    for (const [p, cnt] of Object.entries(row.byPlatform)) {
      const share = orderSum > 0 ? cnt / orderSum : 0;
      totals[p] = (totals[p] ?? 0) + row.totalRevenue * share;
    }
  }
  return Object.entries(totals).map(([name, value]) => ({ name, value }));
}

export function summarizeSales(rows: SalesReportData[]): {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
} {
  if (rows.length === 0) {
    return { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0 };
  }
  const totalOrders = rows.reduce((s, r) => s + r.totalOrders, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  return { totalOrders, totalRevenue, averageOrderValue };
}
