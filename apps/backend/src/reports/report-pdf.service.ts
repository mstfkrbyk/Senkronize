import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import puppeteer from 'puppeteer';

import { PrismaService } from '../prisma/prisma.service';

import { MARKETPLACE_LABEL_TR, ReportsService } from './reports.service';
import type {
  PlatformReportRow,
  StockValueReportDto,
  TopProductRow,
} from './reports.types';

export type ReportPeriod = '7d' | '30d' | '90d';

export interface ReportDateRange {
  from: Date;
  to: Date;
  label: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTr(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(date);
}

function platformLabel(platform: string): string {
  const key = platform as keyof typeof MARKETPLACE_LABEL_TR;
  return MARKETPLACE_LABEL_TR[key] ?? platform;
}

/** Recharts sunucu tarafı render stub — gerçek grafik üretimi sonraki fazda */
const CHART_STUB_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SENKRONIZE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" role="img" aria-label="Senkronize">
  <rect width="48" height="48" rx="12" fill="#0f172a"/>
  <path d="M14 24c0-5.5 4.5-10 10-10h10v6H24a4 4 0 100 8h10v6H24c-5.5 0-10-4.5-10-10z" fill="#38bdf8"/>
</svg>`;

export function parseReportPeriod(period: ReportPeriod): ReportDateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const from = new Date(to);
  from.setDate(from.getDate() - days + 1);
  from.setHours(0, 0, 0, 0);
  return { from, to, label: `Son ${days} gün` };
}

interface ReportKpis {
  totalRevenue: number;
  orderCount: number;
  returnRatePct: number;
}

@Injectable()
export class ReportPdfService {
  private readonly logger = new Logger(ReportPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  async generateSalesReport(
    organizationId: string,
    period: ReportPeriod,
  ): Promise<Buffer> {
    const range = parseReportPeriod(period);
    const [org, kpis, platformRows, topProducts, stockSummary] = await Promise.all([
      this.loadOrg(organizationId),
      this.loadPeriodKpis(organizationId, range.from, range.to),
      this.reportsService.getPlatformReport(organizationId, range.from, range.to),
      this.reportsService.getTopProducts(organizationId, 10, range.from, range.to),
      this.reportsService.getStockValueReport(organizationId),
    ]);
    const html = this.buildReportHtml({
      title: 'Satış Raporu',
      orgName: org.name,
      periodLabel: range.label,
      range,
      kpis,
      platformRows,
      topProducts,
      stockSummary,
      extraSections: [],
      filterSummary: `Dönem: ${range.label}`,
    });
    return await this.renderHtmlToPdf(html);
  }

  async generateStockReport(organizationId: string): Promise<Buffer> {
    const [org, stockSummary, platformRows] = await Promise.all([
      this.loadOrg(organizationId),
      this.reportsService.getStockValueReport(organizationId),
      this.reportsService.getStockValueReport(organizationId).then((s) => s.byPlatform),
    ]);
    const kpis: ReportKpis = {
      totalRevenue: stockSummary.totalStockValue,
      orderCount: stockSummary.totalSkus,
      returnRatePct: 0,
    };
    const platformTable: PlatformReportRow[] = platformRows.map((row) => ({
      platform: row.platform,
      orderCount: row.skuCount,
      revenue: row.totalValue,
    }));
    const html = this.buildReportHtml({
      title: 'Stok Raporu',
      orgName: org.name,
      periodLabel: 'Güncel stok durumu',
      range: null,
      kpis,
      platformRows: platformTable,
      topProducts: [],
      stockSummary,
      extraSections: [
        {
          title: 'Stok özeti',
          rows: [
            ['Toplam ürün (barkod)', String(stockSummary.totalProducts)],
            ['Toplam SKU', String(stockSummary.totalSkus)],
            ['Stokta yok', String(stockSummary.outOfStockCount)],
            ['Düşük stok (1–5)', String(stockSummary.lowStockCount)],
          ],
        },
      ],
      kpiLabels: {
        revenue: 'Toplam stok değeri',
        orders: 'Toplam SKU',
        returnRate: 'Stokta yok',
      },
      kpiValues: {
        returnRate: String(stockSummary.outOfStockCount),
      },
      filterSummary: 'Güncel stok anlık görünümü',
    });
    return await this.renderHtmlToPdf(html);
  }

  async generateProfitReport(
    organizationId: string,
    period: ReportPeriod,
  ): Promise<Buffer> {
    const range = parseReportPeriod(period);
    const [org, profit, stockSummary] = await Promise.all([
      this.loadOrg(organizationId),
      this.reportsService.getProfitReport(organizationId, {
        from: range.from,
        to: range.to,
      }),
      this.reportsService.getStockValueReport(organizationId),
    ]);
    const kpis: ReportKpis = {
      totalRevenue: profit.totalRevenue,
      orderCount: profit.byPlatform.reduce((sum, row) => sum + row.orderCount, 0),
      returnRatePct: profit.profitMargin,
    };
    const platformRows: PlatformReportRow[] = profit.byPlatform.map((row) => ({
      platform: row.platform,
      orderCount: row.orderCount,
      revenue: row.revenue,
    }));
    const topProducts: TopProductRow[] = profit.topProducts.map((row) => ({
      barcode: row.barcode,
      totalQuantity: row.quantity,
      orderCount: 0,
    }));
    const html = this.buildReportHtml({
      title: 'Kâr Raporu',
      orgName: org.name,
      periodLabel: range.label,
      range,
      kpis,
      platformRows,
      topProducts,
      stockSummary,
      extraSections: [
        {
          title: 'Kâr özeti',
          rows: [
            ['Tahmini kâr', formatTry(profit.estimatedProfit)],
            ['Kâr marjı', `${profit.profitMargin.toFixed(1)}%`],
          ],
        },
      ],
      kpiLabels: {
        revenue: 'Toplam gelir (TRY)',
        orders: 'Sipariş sayısı',
        returnRate: 'Kâr marjı (%)',
      },
      kpiValues: {
        returnRate: `${profit.profitMargin.toFixed(1)}%`,
      },
      topProductColumns: ['Barkod / Ürün', 'Adet', 'Gelir (TRY)'],
      topProductRows: profit.topProducts.map((row) => [
        escapeHtml(row.name),
        String(row.quantity),
        formatTry(row.revenue),
      ]),
      filterSummary: `Dönem: ${range.label}`,
    });
    return await this.renderHtmlToPdf(html);
  }

  private async loadOrg(organizationId: string): Promise<{ name: string }> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { name: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı');
    }
    return org;
  }

  private async loadPeriodKpis(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<ReportKpis> {
    const orderBase = {
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: from, lte: to },
    };
    const [orders, returns, revenueAgg] = await Promise.all([
      this.prisma.order.count({
        where: {
          ...orderBase,
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
        },
      }),
      this.prisma.return.count({
        where: {
          organizationId,
          deletedAt: null,
          requestedAt: { gte: from, lte: to },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          ...orderBase,
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
        },
        _sum: { totalAmount: true },
      }),
    ]);
    const totalOrdersAll = await this.prisma.order.count({ where: orderBase });
    const returnRatePct =
      totalOrdersAll === 0
        ? 0
        : Math.round((returns / totalOrdersAll) * 1000) / 10;
    return {
      totalRevenue: Number(revenueAgg._sum.totalAmount ?? 0),
      orderCount: orders,
      returnRatePct,
    };
  }

  private buildReportHtml(params: {
    title: string;
    orgName: string;
    periodLabel: string;
    range: ReportDateRange | null;
    kpis: ReportKpis;
    platformRows: PlatformReportRow[];
    topProducts: TopProductRow[];
    stockSummary: StockValueReportDto;
    extraSections?: { title: string; rows: [string, string][] }[];
    kpiLabels?: { revenue?: string; orders?: string; returnRate?: string };
    kpiValues?: { returnRate?: string };
    topProductColumns?: [string, string, string];
    topProductRows?: [string, string, string][];
    filterSummary?: string;
  }): string {
    const now = formatDateTr(new Date());
    const rangeText = params.range
      ? `${formatDateTr(params.range.from)} – ${formatDateTr(params.range.to)}`
      : now;
    const kpiLabels = {
      revenue: params.kpiLabels?.revenue ?? 'Toplam gelir',
      orders: params.kpiLabels?.orders ?? 'Sipariş sayısı',
      returnRate: params.kpiLabels?.returnRate ?? 'İade oranı',
    };
    const returnRateDisplay =
      params.kpiValues?.returnRate ?? `${params.kpis.returnRatePct.toFixed(1)}%`;

    const platformTable = params.platformRows
      .map(
        (row) => `
      <tr>
        <td>${escapeHtml(platformLabel(row.platform))}</td>
        <td style="text-align:right">${row.orderCount}</td>
        <td style="text-align:right">${formatTry(row.revenue)}</td>
      </tr>`,
      )
      .join('');

    const topColumns = params.topProductColumns ?? ['Barkod', 'Adet', 'Sipariş'];
    const topRows =
      params.topProductRows ??
      params.topProducts.map((row) => [
        escapeHtml(row.barcode),
        String(row.totalQuantity),
        String(row.orderCount),
      ]);
    const topProductsTable = topRows
      .map(
        (cols) => `
      <tr>
        <td>${cols[0]}</td>
        <td style="text-align:right">${cols[1]}</td>
        <td style="text-align:right">${cols[2]}</td>
      </tr>`,
      )
      .join('');

    const extraSectionsHtml = (params.extraSections ?? [])
      .map(
        (section) => `
      <h2>${escapeHtml(section.title)}</h2>
      <table>
        <tbody>
          ${section.rows
            .map(
              ([label, value]) => `
            <tr>
              <td>${escapeHtml(label)}</td>
              <td style="text-align:right">${escapeHtml(value)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>`,
      )
      .join('');

    const filterSummary =
      params.filterSummary ?? `Dönem: ${params.periodLabel}`;
    const chartBlock = `
    <div class="chart-block">
      <img src="data:image/png;base64,${CHART_STUB_BASE64}" alt="Grafik özeti (stub)" width="520" height="120" style="max-width:100%;border-radius:8px;border:1px solid #e2e8f0;" />
      <div class="chart-caption">Grafik görünümü — Recharts sunucu render (yakında)</div>
    </div>`;

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(params.title)}</title>
  <style>
    @page {
      margin: 14mm 12mm 18mm 12mm;
      @bottom-center {
        content: counter(page) " / " counter(pages);
        font-size: 9px;
        color: #94a3b8;
      }
    }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #0f172a; font-size: 13px; background: #f8fafc; }
    .page-body { background: #fff; padding: 8px 0 24px; }
    .cover { min-height: 90vh; display: flex; flex-direction: column; justify-content: center; page-break-after: always; background: #fff; padding: 24px; }
    .logo-wrap { margin-bottom: 24px; }
    .cover-title { font-size: 28px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
    .cover-meta { color: #64748b; line-height: 1.7; font-size: 14px; }
    .brand { color: #0f172a; font-weight: 700; font-size: 20px; margin-bottom: 8px; letter-spacing: -0.02em; }
    .brand-accent { color: #38bdf8; }
    h2 { font-size: 16px; margin: 28px 0 12px; color: #0f172a; border-bottom: 2px solid #38bdf8; padding-bottom: 6px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #38bdf8; border-radius: 8px; padding: 14px; }
    .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi-value { font-size: 20px; font-weight: 700; margin-top: 6px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 20px; }
    th { background: #0f172a; color: #f8fafc; padding: 10px; text-align: left; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .chart-block { margin: 20px 0; text-align: center; }
    .chart-caption { font-size: 10px; color: #94a3b8; margin-top: 6px; }
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      font-size: 9px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding: 8px 12mm;
      display: flex;
      justify-content: space-between;
      background: #fff;
    }
    .footer-note { margin-top: 24px; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="page-footer">
    <span>Senkronize — ${escapeHtml(params.title)}</span>
    <span>${escapeHtml(filterSummary)} · ${escapeHtml(now)}</span>
  </div>
  <section class="cover">
    <div class="brand">Senkronize <span class="brand-accent">·</span> Raporlar</div>
    <div class="logo-wrap">${SENKRONIZE_LOGO_SVG}</div>
    <h1 class="cover-title">${escapeHtml(params.title)}</h1>
    <div class="cover-meta">
      <div><strong>Organizasyon:</strong> ${escapeHtml(params.orgName)}</div>
      <div><strong>Dönem:</strong> ${escapeHtml(params.periodLabel)}</div>
      <div><strong>Tarih aralığı:</strong> ${escapeHtml(rangeText)}</div>
      <div><strong>Rapor tarihi:</strong> ${escapeHtml(now)}</div>
    </div>
  </section>

  <section class="page-body">
    <h2>Özet</h2>
    ${chartBlock}
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">${escapeHtml(kpiLabels.revenue)}</div>
        <div class="kpi-value">${formatTry(params.kpis.totalRevenue)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${escapeHtml(kpiLabels.orders)}</div>
        <div class="kpi-value">${params.kpis.orderCount}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${escapeHtml(kpiLabels.returnRate)}</div>
        <div class="kpi-value">${escapeHtml(returnRateDisplay)}</div>
      </div>
    </div>
    ${extraSectionsHtml}

    <h2>Platform dağılımı</h2>
    <table>
      <thead>
        <tr>
          <th>Platform</th>
          <th style="text-align:right">Sipariş / SKU</th>
          <th style="text-align:right">Gelir / Değer</th>
        </tr>
      </thead>
      <tbody>
        ${
          platformTable ||
          '<tr><td colspan="3">Bu dönemde platform verisi yok.</td></tr>'
        }
      </tbody>
    </table>

    ${
      topRows.length > 0
        ? `<h2>En çok satan ürünler</h2>
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(topColumns[0])}</th>
          <th style="text-align:right">${escapeHtml(topColumns[1])}</th>
          <th style="text-align:right">${escapeHtml(topColumns[2])}</th>
        </tr>
      </thead>
      <tbody>${topProductsTable}</tbody>
    </table>`
        : ''
    }

    <h2>Stok durumu özeti</h2>
    <table>
      <tbody>
        <tr><td>Toplam stok değeri</td><td style="text-align:right">${formatTry(params.stockSummary.totalStockValue)}</td></tr>
        <tr><td>Toplam SKU</td><td style="text-align:right">${params.stockSummary.totalSkus}</td></tr>
        <tr><td>Stokta yok</td><td style="text-align:right">${params.stockSummary.outOfStockCount}</td></tr>
        <tr><td>Düşük stok (1–5)</td><td style="text-align:right">${params.stockSummary.lowStockCount}</td></tr>
      </tbody>
    </table>

    <div class="footer-note">
      Bu belge Senkronize panelinden üretilmiştir. Resmi mali belge yerine geçmez.
      Filtre: ${escapeHtml(filterSummary)} · Oluşturulma: ${escapeHtml(now)}
    </div>
  </section>
</body>
</html>`;
  }

  private async renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width:100%;font-size:9px;color:#94a3b8;padding:0 12mm;display:flex;justify-content:space-between;">
            <span>Senkronize</span>
            <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>`,
        margin: { top: '12mm', bottom: '16mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch((err: unknown) => {
        this.logger.warn('Tarayıcı kapatılamadı', { error: err });
      });
    }
  }

  private async launchBrowser(): Promise<ReturnType<typeof puppeteer.launch>> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    return await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      ...(executablePath ? { executablePath } : {}),
    });
  }
}
