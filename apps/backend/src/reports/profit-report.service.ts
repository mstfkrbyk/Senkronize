import { Injectable } from '@nestjs/common';
import { OrderStatus, type Marketplace, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import commissionConfig from '../config/marketplace-commission.json';
import { CurrencyService } from '../currency/currency.service';
import { PrismaService } from '../prisma/prisma.service';

import { parseRelativeOrMonthPeriod } from './period-parse.util';
import type {
  ProfitByCategoryRow,
  ProfitByPlatformRow,
  ProfitByProductRow,
  ProfitBreakdownReportDto,
} from './profit-report.types';

interface CommissionConfigFile {
  defaultCommissionPercent: number;
  byPlatformPercent: Record<string, number>;
  note: string;
}

const COMMISSION_CFG = commissionConfig as CommissionConfigFile;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function commissionPercentFor(platform: Marketplace): number {
  const fromMap = COMMISSION_CFG.byPlatformPercent[platform];
  if (typeof fromMap === 'number' && Number.isFinite(fromMap)) {
    return fromMap;
  }
  return COMMISSION_CFG.defaultCommissionPercent;
}

@Injectable()
export class ProfitReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyService: CurrencyService,
  ) {}

  async getByPlatform(
    organizationId: string,
    period: string,
  ): Promise<ProfitBreakdownReportDto> {
    const range = parseRelativeOrMonthPeriod(period);
    const orderWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: range.from, lte: range.to },
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
    };

    const prefs =
      await this.currencyService.getOrgCurrencyPrefs(organizationId);

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      select: {
        totalAmount: true,
        currency: true,
        platformCreatedAt: true,
        platform: true,
      },
    });

    const byPlatform = new Map<
      Marketplace,
      { revenue: number; orderCount: number; grossProfit: number }
    >();

    for (const order of orders) {
      const cur = (order.currency ?? 'TRY').trim().toUpperCase();
      const conv = await this.currencyService.orderAmountToTryForReport(
        new Decimal(Number(order.totalAmount)),
        cur,
        order.platformCreatedAt,
        prefs,
      );
      const revenue = conv.tryAmount;
      const pct = commissionPercentFor(order.platform);
      const commission = revenue * (pct / 100);
      const net = revenue - commission;

      const prev = byPlatform.get(order.platform) ?? {
        revenue: 0,
        orderCount: 0,
        grossProfit: 0,
      };
      prev.revenue += revenue;
      prev.orderCount += 1;
      prev.grossProfit += net;
      byPlatform.set(order.platform, prev);
    }

    const rows: ProfitByPlatformRow[] = [...byPlatform.entries()]
      .map(([platform, v]) => {
        const commissionPercent = commissionPercentFor(platform);
        const commissionAmount = roundMoney(
          v.revenue * (commissionPercent / 100),
        );
        const netRevenue = roundMoney(v.revenue - commissionAmount);
        const profitMargin =
          v.revenue > 0 ? roundMoney((v.grossProfit / v.revenue) * 100) : 0;
        return {
          platform,
          grossRevenue: roundMoney(v.revenue),
          commissionPercent,
          commissionAmount,
          netRevenue,
          orderCount: v.orderCount,
          grossProfit: roundMoney(v.grossProfit),
          profitMargin,
        };
      })
      .sort((a, b) => b.netRevenue - a.netRevenue);

    return {
      period: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        label: range.label,
      },
      rows,
    };
  }

  async getByProduct(
    organizationId: string,
    period: string,
    limit = 50,
  ): Promise<ProfitBreakdownReportDto> {
    const range = parseRelativeOrMonthPeriod(period);
    const cappedLimit = Math.min(200, Math.max(1, limit));

    const orderWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: range.from, lte: range.to },
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
    };

    const prefs =
      await this.currencyService.getOrgCurrencyPrefs(organizationId);

    const items = await this.prisma.orderItem.findMany({
      where: { organizationId, order: orderWhere },
      select: {
        barcode: true,
        productName: true,
        quantity: true,
        unitPrice: true,
        order: {
          select: { currency: true, platformCreatedAt: true },
        },
      },
    });

    const barcodes = [...new Set(items.map((i) => i.barcode))];
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        barcode: { in: barcodes },
      },
      select: {
        id: true,
        barcode: true,
        name: true,
        costPrice: true,
      },
    });
    const productByBarcode = new Map(
      products.map((p) => [p.barcode, p] as const),
    );

    const agg = new Map<
      string,
      {
        productId: string | null;
        name: string;
        quantity: number;
        revenue: number;
        costTotal: number;
      }
    >();

    for (const item of items) {
      const cur = (item.order.currency ?? 'TRY').trim().toUpperCase();
      const lineOrig = Number(item.unitPrice) * item.quantity;
      const conv = await this.currencyService.orderAmountToTryForReport(
        new Decimal(lineOrig),
        cur,
        item.order.platformCreatedAt,
        prefs,
      );
      const product = productByBarcode.get(item.barcode);
      const unitCost =
        product?.costPrice != null ? Number(product.costPrice) : 0;
      const costLine = unitCost * item.quantity;

      const prev = agg.get(item.barcode) ?? {
        productId: product?.id ?? null,
        name:
          item.productName?.trim() ||
          product?.name ||
          item.barcode,
        quantity: 0,
        revenue: 0,
        costTotal: 0,
      };
      prev.quantity += item.quantity;
      prev.revenue += conv.tryAmount;
      prev.costTotal += costLine;
      agg.set(item.barcode, prev);
    }

    const fixedRows = [...agg.entries()]
      .map(([barcode, v]) => {
        const grossProfit = roundMoney(v.revenue - v.costTotal);
        const profitMargin =
          v.revenue > 0 ? roundMoney((grossProfit / v.revenue) * 100) : 0;
        return {
          productId: v.productId,
          barcode,
          name: v.name,
          quantitySold: v.quantity,
          revenue: roundMoney(v.revenue),
          costTotal: roundMoney(v.costTotal),
          grossProfit,
          profitMargin,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, cappedLimit);

    return {
      period: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        label: range.label,
      },
      rows: fixedRows,
    };
  }

  async getByCategory(
    organizationId: string,
    period: string,
  ): Promise<ProfitBreakdownReportDto> {
    const range = parseRelativeOrMonthPeriod(period);
    const productReport = await this.getByProduct(
      organizationId,
      period,
      10_000,
    );
    const productRows = productReport.rows as ProfitByProductRow[];

    const barcodes = productRows.map((r) => r.barcode);
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        barcode: { in: barcodes },
      },
      select: {
        barcode: true,
        category: true,
        productCategory: { select: { name: true } },
      },
    });
    const categoryByBarcode = new Map(
      products.map(
        (p) =>
          [
            p.barcode,
            p.productCategory?.name ?? p.category ?? 'Kategorisiz',
          ] as const,
      ),
    );

    const byCategory = new Map<
      string,
      {
        quantity: number;
        revenue: number;
        costTotal: number;
      }
    >();

    for (const row of productRows) {
      const cat = categoryByBarcode.get(row.barcode) ?? 'Kategorisiz';
      const prev = byCategory.get(cat) ?? {
        quantity: 0,
        revenue: 0,
        costTotal: 0,
      };
      prev.quantity += row.quantitySold;
      prev.revenue += row.revenue;
      prev.costTotal += row.costTotal;
      byCategory.set(cat, prev);
    }

    const rows: ProfitByCategoryRow[] = [...byCategory.entries()]
      .map(([category, v]) => {
        const grossProfit = roundMoney(v.revenue - v.costTotal);
        const profitMargin =
          v.revenue > 0 ? roundMoney((grossProfit / v.revenue) * 100) : 0;
        return {
          category,
          quantitySold: v.quantity,
          revenue: roundMoney(v.revenue),
          costTotal: roundMoney(v.costTotal),
          grossProfit,
          profitMargin,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit);

    return {
      period: productReport.period,
      rows,
    };
  }
}
