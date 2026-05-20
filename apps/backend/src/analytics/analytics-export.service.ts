import { Injectable } from '@nestjs/common';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

import {
  parsePeriodDays,
  rangeForDays,
} from './analytics-period.util';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsExportFormat, AnalyticsExportType } from './analytics.types';

@Injectable()
export class AnalyticsExportService {
  constructor(private readonly analytics: AnalyticsService) {}

  async export(
    organizationId: string,
    type: AnalyticsExportType,
    format: AnalyticsExportFormat,
    period: string | undefined,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const periodDays = parsePeriodDays(period, 30);
    const rows = await this.buildRows(organizationId, type, periodDays);
    const filename = this.filenameFor(type, format, periodDays);
    const buffer = this.encode(rows, format);
    const mime =
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8';
    return { buffer, filename, mime };
  }

  private filenameFor(
    type: AnalyticsExportType,
    format: AnalyticsExportFormat,
    periodDays: number,
  ): string {
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    return `analitik-${type}-${String(periodDays)}d.${ext}`;
  }

  private async buildRows(
    organizationId: string,
    type: AnalyticsExportType,
    periodDays: number,
  ): Promise<Record<string, string | number>[]> {
    if (type === 'revenue') {
      const trend = await this.analytics.getDailyRevenueTrend(
        organizationId,
        periodDays,
      );
      return trend.points.map((p) => ({
        tarih: p.date,
        gelir: p.revenue,
        siparis: p.orderCount,
      }));
    }

    if (type === 'orders') {
      const { from, to } = rangeForDays(periodDays);
      const comparison = await this.analytics.getPlatformComparison(
        organizationId,
        `${String(periodDays)}d`,
      );
      void from;
      void to;
      return comparison.platforms.map((p) => ({
        platform: p.label,
        siparis: p.orderCount,
        gelir: p.revenue,
        buybox_kazanma: p.buyBoxWinRate,
        buyume_yuzde: p.growthPct,
      }));
    }

    const top = await this.analytics.getTopProducts(
      organizationId,
      `${String(periodDays)}d`,
      100,
    );
    return top.products.map((p) => ({
      barkod: p.barcode,
      urun: p.productName ?? '',
      adet: p.quantity,
      gelir: p.revenue,
      siparis: p.orderCount,
    }));
  }

  private encode(
    rows: Record<string, string | number>[],
    format: AnalyticsExportFormat,
  ): Buffer {
    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Analitik');
      return Buffer.from(
        XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
      );
    }

    const csv = Papa.unparse(rows, { header: true });
    const body = csv.startsWith('\uFEFF') ? csv : `\uFEFF${csv}`;
    return Buffer.from(body, 'utf-8');
  }
}
