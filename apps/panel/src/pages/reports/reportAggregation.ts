import { endOfMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';

import type { SalesReportData } from '@/types/report';

function emptyRow(period: string): SalesReportData {
  return {
    period,
    totalOrders: 0,
    totalRevenue: 0,
    byPlatform: {},
  };
}

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
      const m = startOfMonth(d);
      key = endOfMonth(m).toISOString().slice(0, 7);
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
  return rows.map((row) => ({
    ...row,
    totalOrders: row.byPlatform[platform] ?? 0,
    totalRevenue: row.totalRevenue * ((row.byPlatform[platform] ?? 0) / Math.max(1, sumPlatforms(row.byPlatform))),
    byPlatform: { [platform]: row.byPlatform[platform] ?? 0 },
  }));
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
