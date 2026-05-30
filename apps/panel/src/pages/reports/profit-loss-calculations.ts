import type { ProductCostRow } from '@/hooks/useProducts';
import type { ProfitPlatformRow } from '@/types/report';

const COMMISSION_RATE = 0.12;

export interface ProfitBreakdown {
  revenue: number;
  productCost: number;
  platformCommission: number;
  shippingCost: number;
  netProfit: number;
  usesProductCosts: boolean;
}

export interface TopProductChartRow {
  name: string;
  profit: number;
  revenue: number;
}

export function buildCostByBarcode(rows: ProductCostRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.costPrice > 0) {
      map.set(row.barcode, row.costPrice);
    }
  }
  return map;
}

export function hasAnyProductCost(rows: ProductCostRow[]): boolean {
  return rows.some((row) => row.costPrice > 0);
}

export function computeProfitBreakdown(
  revenue: number,
  topProducts: { barcode: string; revenue: number; quantity: number }[],
  costByBarcode: Map<string, number>,
  usesProductCosts: boolean,
  fallbackNetProfit: number,
): ProfitBreakdown {
  if (!usesProductCosts || revenue <= 0) {
    const netProfit = fallbackNetProfit;
    const totalCost = revenue - netProfit;
    const platformCommission = Math.round(revenue * COMMISSION_RATE);
    const shippingCost = Math.round(totalCost * 0.15);
    const productCost = Math.max(0, totalCost - platformCommission - shippingCost);
    return {
      revenue,
      productCost,
      platformCommission,
      shippingCost,
      netProfit,
      usesProductCosts: false,
    };
  }

  let productCost = 0;
  let matchedRevenue = 0;
  for (const row of topProducts) {
    const unitCost = costByBarcode.get(row.barcode);
    if (unitCost === undefined || unitCost <= 0) {
      continue;
    }
    productCost += unitCost * row.quantity;
    matchedRevenue += row.revenue;
  }

  if (matchedRevenue > 0 && revenue > matchedRevenue) {
    productCost = Math.round(productCost * (revenue / matchedRevenue));
  } else {
    productCost = Math.round(productCost);
  }

  const platformCommission = Math.round(revenue * COMMISSION_RATE);
  const shippingCost = Math.round(Math.max(0, revenue - productCost) * 0.15);
  const netProfit = Math.max(
    0,
    revenue - productCost - platformCommission - shippingCost,
  );

  return {
    revenue,
    productCost,
    platformCommission,
    shippingCost,
    netProfit,
    usesProductCosts: true,
  };
}

function splitPlatformCosts(
  revenue: number,
  totalRevenue: number,
  totalProfit: number,
): {
  productCost: number;
  shippingCost: number;
  platformCommission: number;
  profit: number;
} {
  if (totalRevenue <= 0) {
    return { productCost: 0, shippingCost: 0, platformCommission: 0, profit: 0 };
  }
  const share = revenue / totalRevenue;
  const profit = Math.round(totalProfit * share);
  const totalCost = revenue - profit;
  const platformCommission = Math.round(revenue * COMMISSION_RATE * share);
  const shippingCost = Math.round(totalCost * 0.15);
  const productCost = Math.max(0, totalCost - platformCommission - shippingCost);
  return { productCost, shippingCost, platformCommission, profit };
}

export function computePlatformRows(
  byPlatform: { platform: string; revenue: number }[],
  totalRevenue: number,
  netProfit: number,
): ProfitPlatformRow[] {
  const totalRev = totalRevenue || 1;
  return byPlatform.map((row) => {
    const costs = splitPlatformCosts(row.revenue, totalRev, netProfit);
    const marginPct = row.revenue > 0 ? (costs.profit / row.revenue) * 100 : 0;
    return {
      platform: row.platform,
      revenue: row.revenue,
      shippingCost: costs.shippingCost,
      vatAmount: costs.platformCommission,
      productCost: costs.productCost,
      profit: costs.profit,
      marginPct,
    };
  });
}

export function computeTopProductsChart(
  topProducts: { name: string; barcode: string; revenue: number; quantity: number }[],
  costByBarcode: Map<string, number>,
  usesProductCosts: boolean,
): TopProductChartRow[] {
  const items = [...topProducts]
    .map((p) => {
      const unitCost = costByBarcode.get(p.barcode) ?? 0;
      const profit = usesProductCosts && unitCost > 0
        ? Math.round(p.revenue - unitCost * p.quantity)
        : Math.round(p.revenue * 0.25);
      return {
        name: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
        profit,
        revenue: p.revenue,
      };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);
  return items;
}
