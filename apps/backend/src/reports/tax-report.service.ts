import { Injectable } from '@nestjs/common';
import { OrderStatus, type Marketplace } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import vatRatesConfig from '../config/vat-rates.json';
import type {
  VatPlatformBreakdown,
  VatRateBreakdown,
  VatReport,
} from './tax-report.types';

interface VatRatesFile {
  defaultVatRatePercent: number;
  includedInPrices: boolean;
  orderStatusesForVatReport: string[];
  additionalVatRatesPercent: number[];
  skuVatRatePercent: Record<string, number>;
  reportingNote: string;
}

const VAT_CFG = vatRatesConfig as VatRatesFile;

function monthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function toNumber(d: { toString(): string }): number {
  return Number(d.toString());
}

function splitVatFromGross(
  gross: number,
  ratePercent: number,
  includedInPrices: boolean,
): { net: number; vat: number } {
  if (!includedInPrices) {
    const vat = (gross * ratePercent) / 100;
    return { net: gross, vat };
  }
  const divisor = 1 + ratePercent / 100;
  const net = gross / divisor;
  const vat = gross - net;
  return { net, vat };
}

function resolveStatuses(): OrderStatus[] {
  const allowed = new Set(VAT_CFG.orderStatusesForVatReport);
  const all = Object.values(OrderStatus);
  const picked = all.filter((s) => allowed.has(s));
  if (picked.length > 0) {
    return picked;
  }
  return [OrderStatus.INVOICED, OrderStatus.SHIPPED, OrderStatus.DELIVERED];
}

function rateForSku(sku: string): number {
  const fromMap = VAT_CFG.skuVatRatePercent[sku];
  if (typeof fromMap === 'number' && Number.isFinite(fromMap)) {
    return fromMap;
  }
  return VAT_CFG.defaultVatRatePercent;
}

@Injectable()
export class TaxReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateVatReport(
    organizationId: string,
    year: number,
    month: number,
  ): Promise<VatReport> {
    const { start, end } = monthBounds(year, month);
    const statuses = resolveStatuses();

    const orders = await this.prisma.order.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: statuses },
        platformCreatedAt: { gte: start, lte: end },
      },
      include: { items: true },
    });

    const byPlatformMap = new Map<
      Marketplace,
      { gross: number; vat: number; net: number; orders: number }
    >();
    const byRateMap = new Map<
      number,
      { gross: number; vat: number; net: number }
    >();

    let grossTotal = 0;
    let vatTotal = 0;
    let netTotal = 0;

    for (const order of orders) {
      const platform = order.platform;
      if (!byPlatformMap.has(platform)) {
        byPlatformMap.set(platform, { gross: 0, vat: 0, net: 0, orders: 0 });
      }
      const pAgg = byPlatformMap.get(platform)!;
      pAgg.orders += 1;

      const orderGross = toNumber(order.totalAmount);
      if (order.items.length === 0) {
        const rate = VAT_CFG.defaultVatRatePercent;
        const { net, vat } = splitVatFromGross(
          orderGross,
          rate,
          VAT_CFG.includedInPrices,
        );
        grossTotal += orderGross;
        vatTotal += vat;
        netTotal += net;
        pAgg.gross += orderGross;
        pAgg.vat += vat;
        pAgg.net += net;
        this.addRateBucket(byRateMap, rate, orderGross, vat, net);
        continue;
      }

      let orderNetSum = 0;
      let orderVatSum = 0;
      for (const item of order.items) {
        const lineGross = toNumber(item.unitPrice) * item.quantity;
        const rate = rateForSku(item.sku);
        const { net, vat } = splitVatFromGross(
          lineGross,
          rate,
          VAT_CFG.includedInPrices,
        );
        orderNetSum += net;
        orderVatSum += vat;
        this.addRateBucket(byRateMap, rate, lineGross, vat, net);
      }

      const lineGrossSum = order.items.reduce(
        (acc, it) => acc + toNumber(it.unitPrice) * it.quantity,
        0,
      );
      const drift = orderGross - lineGrossSum;
      if (Math.abs(drift) > 0.009) {
        const rate = VAT_CFG.defaultVatRatePercent;
        const { net: dn, vat: dv } = splitVatFromGross(
          drift,
          rate,
          VAT_CFG.includedInPrices,
        );
        orderNetSum += dn;
        orderVatSum += dv;
        this.addRateBucket(byRateMap, rate, drift, dv, dn);
      }

      grossTotal += orderGross;
      vatTotal += orderVatSum;
      netTotal += orderNetSum;
      pAgg.gross += orderGross;
      pAgg.vat += orderVatSum;
      pAgg.net += orderNetSum;
    }

    const byPlatform: VatPlatformBreakdown[] = [...byPlatformMap.entries()]
      .map(([platform, v]) => ({
        platform,
        orderCount: v.orders,
        grossSales: roundMoney(v.gross),
        vatAmount: roundMoney(v.vat),
        netSales: roundMoney(v.net),
      }))
      .sort((a, b) => b.grossSales - a.grossSales);

    const byVatRate: VatRateBreakdown[] = [...byRateMap.entries()]
      .map(([vatRatePercent, v]) => ({
        vatRatePercent,
        grossSales: roundMoney(v.gross),
        vatAmount: roundMoney(v.vat),
        netSales: roundMoney(v.net),
      }))
      .sort((a, b) => b.vatRatePercent - a.vatRatePercent);

    return {
      period: { year, month },
      grossSales: roundMoney(grossTotal),
      vatAmount: roundMoney(vatTotal),
      netSales: roundMoney(netTotal),
      byPlatform,
      byVatRate,
      reportingNote: VAT_CFG.reportingNote,
      defaultVatRatePercent: VAT_CFG.defaultVatRatePercent,
    };
  }

  private addRateBucket(
    byRateMap: Map<number, { gross: number; vat: number; net: number }>,
    rate: number,
    gross: number,
    vat: number,
    net: number,
  ): void {
    if (!byRateMap.has(rate)) {
      byRateMap.set(rate, { gross: 0, vat: 0, net: 0 });
    }
    const b = byRateMap.get(rate)!;
    b.gross += gross;
    b.vat += vat;
    b.net += net;
  }

  async exportVatReportCsv(
    organizationId: string,
    year: number,
    month: number,
  ): Promise<string> {
    const report = await this.generateVatReport(organizationId, year, month);
    const { start, end } = monthBounds(year, month);
    const statuses = resolveStatuses();

    const orders = await this.prisma.order.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: statuses },
        platformCreatedAt: { gte: start, lte: end },
      },
      include: { items: true },
      orderBy: { platformCreatedAt: 'asc' },
    });

    const sep = ';';
    const lines: string[] = [];
    const esc = (v: string): string => `"${v.replace(/"/g, '""')}"`;

    lines.push(
      [
        'TIP',
        'YIL',
        'AY',
        'PLATFORM',
        'SIPARIS_ID',
        'PAZARYERI_SIPARIS_NO',
        'SATIR_SKU',
        'KDV_ORANI',
        'BRUT',
        'KDV',
        'NET',
      ].join(sep),
    );

    lines.push(
      [
        'OZET',
        String(year),
        String(month),
        '',
        '',
        '',
        '',
        String(report.defaultVatRatePercent),
        csvNum(report.grossSales),
        csvNum(report.vatAmount),
        csvNum(report.netSales),
      ].join(sep),
    );

    for (const order of orders) {
      if (order.items.length === 0) {
        const rate = VAT_CFG.defaultVatRatePercent;
        const g = toNumber(order.totalAmount);
        const { net, vat } = splitVatFromGross(
          g,
          rate,
          VAT_CFG.includedInPrices,
        );
        lines.push(
          [
            'SIPARIS',
            String(year),
            String(month),
            esc(order.platform),
            esc(order.id),
            esc(order.platformOrderId),
            esc(''),
            String(rate),
            csvNum(g),
            csvNum(vat),
            csvNum(net),
          ].join(sep),
        );
        continue;
      }
      for (const item of order.items) {
        const lineGross = toNumber(item.unitPrice) * item.quantity;
        const rate = rateForSku(item.sku);
        const { net, vat } = splitVatFromGross(
          lineGross,
          rate,
          VAT_CFG.includedInPrices,
        );
        lines.push(
          [
            'SATIR',
            String(year),
            String(month),
            esc(order.platform),
            esc(order.id),
            esc(order.platformOrderId),
            esc(item.sku),
            String(rate),
            csvNum(lineGross),
            csvNum(vat),
            csvNum(net),
          ].join(sep),
        );
      }
    }

    return `\ufeff${lines.join('\n')}`;
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function csvNum(n: number): string {
  return String(roundMoney(n)).replace('.', ',');
}
