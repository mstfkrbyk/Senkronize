import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, OrderStatus, Prisma, ReportType, type SavedReport } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { createHash } from 'crypto';

import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import { ProfitReportService } from './profit-report.service';
import { parseRelativeOrMonthPeriod } from './period-parse.util';
import type {
  MetricsReportConfig,
  MetricsReportResult,
  ReportConfig,
  ReportDateRange,
  ReportDimensionId,
  ReportFilter,
  ReportMetricId,
  ReportResult,
  ScheduledCustomReportItem,
  SavedReportListItem,
  SavedReportSchedule,
} from './custom-report.types';
import type {
  MetricsReportBodyDto,
  SaveReportBodyDto,
  ScheduleCustomReportBodyDto,
} from './custom-report.dto';
import { MARKETPLACE_LABEL_TR, ReportsService } from './reports.service';

const ORDER_SELECT_FIELDS = new Set([
  'id',
  'platform',
  'platformOrderId',
  'status',
  'customerName',
  'customerPhone',
  'totalAmount',
  'currency',
  'platformCreatedAt',
  'syncedAt',
  'shippingAddress',
]);

const PRODUCT_SELECT_FIELDS = new Set([
  'id',
  'barcode',
  'sku',
  'name',
  'brand',
  'category',
  'costPrice',
  'isActive',
  'createdAt',
  'updatedAt',
]);

const LISTING_SELECT_FIELDS = new Set([
  'id',
  'platform',
  'platformProductId',
  'barcode',
  'title',
  'salePrice',
  'listPrice',
  'quantity',
  'approved',
  'lastSyncAt',
  'createdAt',
]);

const STOCK_ENTRY_SELECT_FIELDS = new Set([
  'id',
  'barcode',
  'platform',
  'quantity',
  'reservedQty',
  'warehouseId',
  'productId',
  'updatedAt',
  'createdAt',
]);

const ORDER_FILTER_FIELDS = new Set([
  'status',
  'platform',
  'totalAmount',
  'customerName',
  'currency',
]);

const PRODUCT_FILTER_FIELDS = new Set([
  'name',
  'barcode',
  'brand',
  'category',
  'isActive',
]);

const LISTING_FILTER_FIELDS = new Set([
  'platform',
  'barcode',
  'title',
  'approved',
  'quantity',
]);

const STOCK_FILTER_FIELDS = new Set([
  'barcode',
  'platform',
  'quantity',
  'warehouseId',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseMarketplace(v: string): Marketplace {
  if (Object.prototype.hasOwnProperty.call(Marketplace, v)) {
    return Marketplace[v as keyof typeof Marketplace];
  }
  throw new BadRequestException(`Geçersiz platform: ${v}`);
}

function parseOrderStatus(v: string): OrderStatus {
  if (Object.prototype.hasOwnProperty.call(OrderStatus, v)) {
    return OrderStatus[v as keyof typeof OrderStatus];
  }
  throw new BadRequestException(`Geçersiz sipariş durumu: ${v}`);
}

function parseDateRange(range?: ReportDateRange): { from: Date; to: Date } | undefined {
  if (!range?.from || !range?.to) {
    return undefined;
  }
  const from = new Date(range.from);
  const to = new Date(range.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException('Geçersiz tarih aralığı');
  }
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function serializeCell(v: unknown): unknown {
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (v instanceof Decimal) {
    return Number(v);
  }
  if (typeof v === 'bigint') {
    return Number(v);
  }
  return v;
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = serializeCell(v);
  }
  return out;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const esc = (c: unknown): string => {
    const s = c === null || c === undefined ? '' : String(c);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(','));
  }
  return lines.join('\n');
}

function parseReportConfig(raw: unknown): ReportConfig {
  if (!isRecord(raw)) {
    throw new BadRequestException('Geçersiz rapor yapılandırması');
  }
  const reportType = raw.reportType;
  if (
    typeof reportType !== 'string' ||
    !Object.values(ReportType).includes(reportType as ReportType)
  ) {
    throw new BadRequestException('Geçersiz rapor tipi');
  }
  const columns = raw.columns;
  if (!Array.isArray(columns) || !columns.every((c) => typeof c === 'string')) {
    throw new BadRequestException('Kolon listesi geçersiz');
  }
  const filters = raw.filters;
  if (!Array.isArray(filters)) {
    throw new BadRequestException('Filtre listesi geçersiz');
  }
  const parsedFilters: ReportFilter[] = [];
  for (const f of filters) {
    if (!isRecord(f)) {
      throw new BadRequestException('Filtre öğesi geçersiz');
    }
    const field = f.field;
    const operator = f.operator;
    if (typeof field !== 'string' || typeof operator !== 'string') {
      throw new BadRequestException('Filtre alanı veya operatör geçersiz');
    }
    if (!['eq', 'gt', 'lt', 'contains', 'in'].includes(operator)) {
      throw new BadRequestException('Geçersiz filtre operatörü');
    }
    parsedFilters.push({
      field,
      operator: operator as ReportFilter['operator'],
      value: f.value,
    });
  }
  let dateRange: ReportDateRange | undefined;
  if (raw.dateRange !== undefined) {
    if (!isRecord(raw.dateRange)) {
      throw new BadRequestException('Tarih aralığı geçersiz');
    }
    const from = raw.dateRange.from;
    const to = raw.dateRange.to;
    if (typeof from !== 'string' || typeof to !== 'string') {
      throw new BadRequestException('Tarih aralığı geçersiz');
    }
    dateRange = { from, to };
  }
  let platforms: string[] | undefined;
  if (raw.platforms !== undefined) {
    if (!Array.isArray(raw.platforms) || !raw.platforms.every((p) => typeof p === 'string')) {
      throw new BadRequestException('Platform listesi geçersiz');
    }
    platforms = raw.platforms as string[];
  }
  let columnLabels: Record<string, string> | undefined;
  if (raw.columnLabels !== undefined) {
    if (!isRecord(raw.columnLabels)) {
      throw new BadRequestException('Kolon etiketleri geçersiz');
    }
    columnLabels = {};
    for (const [k, v] of Object.entries(raw.columnLabels)) {
      if (typeof v === 'string') {
        columnLabels[k] = v;
      }
    }
  }
  let columnHidden: Record<string, boolean> | undefined;
  if (raw.columnHidden !== undefined) {
    if (!isRecord(raw.columnHidden)) {
      throw new BadRequestException('Kolon gizleme geçersiz');
    }
    columnHidden = {};
    for (const [k, v] of Object.entries(raw.columnHidden)) {
      if (typeof v === 'boolean') {
        columnHidden[k] = v;
      }
    }
  }
  const groupBy = typeof raw.groupBy === 'string' ? raw.groupBy : undefined;
  const orderBy = typeof raw.orderBy === 'string' ? raw.orderBy : undefined;
  const limit =
    typeof raw.limit === 'number' && Number.isFinite(raw.limit)
      ? Math.min(10_000, Math.max(1, Math.floor(raw.limit)))
      : undefined;

  return {
    reportType: reportType as ReportType,
    columns,
    columnLabels,
    columnHidden,
    filters: parsedFilters,
    groupBy,
    orderBy,
    dateRange,
    platforms,
    limit,
  };
}

function parseScheduleJson(
  value: Prisma.JsonValue | null | undefined,
): SavedReportSchedule | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  const cron = value.cron;
  const emails = value.emails;
  if (typeof cron !== 'string' || !Array.isArray(emails)) {
    return null;
  }
  const cleanEmails = emails.filter((e): e is string => typeof e === 'string');
  const format =
    value.format === 'csv' || value.format === 'json' ? value.format : 'csv';
  const frequency =
    value.frequency === 'weekly' || value.frequency === 'daily'
      ? value.frequency
      : 'daily';
  return { cron, emails: cleanEmails, format, frequency };
}

function buildScheduleJson(dto: {
  cron?: string | null;
  emails: string[];
  format?: 'csv' | 'json';
  frequency?: 'daily' | 'weekly';
}): Prisma.InputJsonValue {
  const frequency = dto.frequency ?? 'daily';
  const cron =
    dto.cron?.trim() ||
    (frequency === 'weekly' ? '0 0 * * 1' : '0 0 * * *');
  return {
    cron,
    emails: dto.emails,
    format: dto.format ?? 'csv',
    frequency,
  };
}

@Injectable()
export class CustomReportService {
  private readonly logger = new Logger(CustomReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
    private readonly notificationService: NotificationService,
    private readonly profitReportService: ProfitReportService,
  ) {}

  async runMetricsReport(
    organizationId: string,
    body: MetricsReportBodyDto,
  ): Promise<MetricsReportResult> {
    const config: MetricsReportConfig = {
      metrics: body.metrics,
      dimensions: body.dimensions,
      period: body.period,
      platforms: body.platforms,
      limit: body.limit,
    };
    return this.runMetricsReportFromConfig(organizationId, config);
  }

  async scheduleCustomReport(
    organizationId: string,
    userId: string,
    dto: ScheduleCustomReportBodyDto,
  ): Promise<ScheduledCustomReportItem> {
    const frequency = dto.frequency ?? 'weekly';
    const cron =
      frequency === 'monthly'
        ? '0 0 1 * *'
        : frequency === 'weekly'
          ? '0 0 * * 1'
          : '0 0 * * *';
    const schedule = buildScheduleJson({
      cron,
      emails: dto.emails,
      format: dto.format ?? 'csv',
      frequency: frequency === 'monthly' ? 'weekly' : frequency,
    });
    const config: ReportConfig = {
      reportType: ReportType.CUSTOM,
      columns: dto.report.metrics,
      filters: [],
      groupBy: dto.report.dimensions[0],
      platforms: dto.report.platforms,
      limit: dto.report.limit,
    };
    const row = await this.prisma.savedReport.create({
      data: {
        organizationId,
        createdBy: userId,
        name: dto.name.trim(),
        reportType: ReportType.CUSTOM,
        config: {
          ...config,
          metricsMode: true,
          metrics: dto.report.metrics,
          dimensions: dto.report.dimensions,
          period: dto.report.period,
        } as unknown as Prisma.InputJsonValue,
        schedule: schedule as Prisma.InputJsonValue,
      },
    });
    const parsed = parseScheduleJson(row.schedule);
    return {
      id: row.id,
      name: row.name,
      schedule: parsed!,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listScheduledCustomReports(
    organizationId: string,
  ): Promise<ScheduledCustomReportItem[]> {
    const rows = await this.prisma.savedReport.findMany({
      where: {
        organizationId,
        schedule: { not: Prisma.DbNull },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows
      .map((row) => {
        const schedule = parseScheduleJson(row.schedule);
        if (!schedule || schedule.emails.length === 0) {
          return null;
        }
        return {
          id: row.id,
          name: row.name,
          schedule,
          lastRunAt: row.lastRunAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        };
      })
      .filter((r): r is ScheduledCustomReportItem => r !== null);
  }

  async deleteScheduledCustomReport(
    organizationId: string,
    id: string,
  ): Promise<void> {
    const res = await this.prisma.savedReport.updateMany({
      where: { id, organizationId },
      data: { schedule: Prisma.DbNull },
    });
    if (res.count === 0) {
      throw new NotFoundException('Zamanlanmış rapor bulunamadı');
    }
  }

  private async runMetricsReportFromConfig(
    organizationId: string,
    config: MetricsReportConfig,
  ): Promise<MetricsReportResult> {
    const range = parseRelativeOrMonthPeriod(config.period);
    const primaryDim = config.dimensions[0] ?? 'platform';
    const limit = Math.min(500, config.limit ?? 100);

    const platformFilter =
      config.platforms && config.platforms.length > 0
        ? { in: config.platforms.map((p) => parseMarketplace(p)) }
        : undefined;

    const orderWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: range.from, lte: range.to },
      ...(platformFilter ? { platform: platformFilter } : {}),
    };

    const goodOrderWhere: Prisma.OrderWhereInput = {
      ...orderWhere,
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
    };

    const bucketKey = (raw: string): string => raw;

    type Bucket = Record<string, number | string>;
    const buckets = new Map<string, Bucket>();

    const ensure = (key: string): Bucket => {
      if (!buckets.has(key)) {
        buckets.set(key, { [primaryDim]: key });
      }
      return buckets.get(key)!;
    };

    if (
      primaryDim === 'date' ||
      primaryDim === 'platform' ||
      primaryDim === 'product'
    ) {
      const orders = await this.prisma.order.findMany({
        where: orderWhere,
        select: {
          platformCreatedAt: true,
          platform: true,
          status: true,
          totalAmount: true,
          items: { select: { barcode: true, quantity: true, unitPrice: true } },
        },
      });

      const totalOrders = orders.length;
      const cancelled = orders.filter(
        (o) =>
          o.status === OrderStatus.CANCELLED ||
          o.status === OrderStatus.RETURNED,
      ).length;

      for (const order of orders) {
        let key: string;
        if (primaryDim === 'date') {
          const d = order.platformCreatedAt;
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } else if (primaryDim === 'platform') {
          key = order.platform;
        } else {
          for (const item of order.items) {
            const b = ensure(bucketKey(item.barcode));
            const isGood =
              order.status !== OrderStatus.CANCELLED &&
              order.status !== OrderStatus.RETURNED;
            if (isGood) {
              b.orders = Number(b.orders ?? 0) + 1;
              b.units_sold = Number(b.units_sold ?? 0) + item.quantity;
              b.revenue =
                Number(b.revenue ?? 0) +
                Number(item.unitPrice) * item.quantity;
            }
          }
          continue;
        }
        const b = ensure(bucketKey(key));
        b.orders = Number(b.orders ?? 0) + 1;
        if (
          order.status !== OrderStatus.CANCELLED &&
          order.status !== OrderStatus.RETURNED
        ) {
          b.revenue = Number(b.revenue ?? 0) + Number(order.totalAmount);
        }
        if (order.status === OrderStatus.CANCELLED) {
          b.cancellation_rate = Number(b.cancellation_rate ?? 0) + 1;
        }
      }

      if (config.metrics.includes('return_rate')) {
        const returns = await this.prisma.return.count({
          where: {
            organizationId,
            deletedAt: null,
            requestedAt: { gte: range.from, lte: range.to },
          },
        });
        const globalRate =
          totalOrders > 0 ? (returns / totalOrders) * 100 : 0;
        for (const b of buckets.values()) {
          b.return_rate = Math.round(globalRate * 10) / 10;
        }
      }

      if (config.metrics.includes('cancellation_rate')) {
        const rate =
          totalOrders > 0 ? (cancelled / totalOrders) * 100 : 0;
        for (const b of buckets.values()) {
          const localCancelled = Number(b.cancellation_rate ?? 0);
          const localOrders = Number(b.orders ?? 0);
          b.cancellation_rate =
            localOrders > 0
              ? Math.round((localCancelled / localOrders) * 1000) / 10
              : Math.round(rate * 10) / 10;
        }
      }
    }

    if (primaryDim === 'category') {
      const items = await this.prisma.orderItem.findMany({
        where: { organizationId, order: goodOrderWhere },
        select: {
          barcode: true,
          quantity: true,
          unitPrice: true,
        },
      });
      const barcodes = [...new Set(items.map((i) => i.barcode))];
      const products = await this.prisma.product.findMany({
        where: { organizationId, deletedAt: null, barcode: { in: barcodes } },
        select: {
          barcode: true,
          category: true,
          productCategory: { select: { name: true } },
        },
      });
      const catMap = new Map(
        products.map(
          (p) =>
            [
              p.barcode,
              p.productCategory?.name ?? p.category ?? 'Kategorisiz',
            ] as const,
        ),
      );
      for (const item of items) {
        const cat = catMap.get(item.barcode) ?? 'Kategorisiz';
        const b = ensure(bucketKey(cat));
        b.revenue =
          Number(b.revenue ?? 0) + Number(item.unitPrice) * item.quantity;
        b.units_sold = Number(b.units_sold ?? 0) + item.quantity;
        b.orders = Number(b.orders ?? 0) + 1;
      }
    }

    if (primaryDim === 'warehouse') {
      const stock = await this.prisma.stockEntry.findMany({
        where: { organizationId },
        select: {
          warehouseId: true,
          quantity: true,
          barcode: true,
        },
      });
      for (const s of stock) {
        const wh = s.warehouseId ?? 'varsayilan';
        const b = ensure(bucketKey(wh));
        b.stock_value = Number(b.stock_value ?? 0) + s.quantity;
        b.listing_count = Number(b.listing_count ?? 0) + 1;
      }
    }

    if (config.metrics.includes('buybox_win_rate')) {
      const wins = await this.prisma.buyBoxSnapshot.groupBy({
        by: ['platform'],
        where: {
          organizationId,
          capturedAt: { gte: range.from, lte: range.to },
          isWinner: true,
        },
        _count: { _all: true },
      });
      const checks = await this.prisma.buyBoxSnapshot.groupBy({
        by: ['platform'],
        where: {
          organizationId,
          capturedAt: { gte: range.from, lte: range.to },
        },
        _count: { _all: true },
      });
      const checkMap = new Map(
        checks.map((c) => [c.platform, c._count._all] as const),
      );
      for (const w of wins) {
        const key =
          primaryDim === 'platform' ? w.platform : String(w.platform);
        const b = ensure(bucketKey(key));
        const total = checkMap.get(w.platform) ?? 0;
        b.buybox_win_rate =
          total > 0
            ? Math.round((w._count._all / total) * 1000) / 10
            : 0;
      }
    }

    if (
      config.metrics.includes('gross_profit') ||
      config.metrics.includes('profit_margin')
    ) {
      const byProduct = await this.profitReportService.getByProduct(
        organizationId,
        config.period,
        limit,
      );
      for (const row of byProduct.rows) {
        if ('barcode' in row && primaryDim === 'product') {
          const b = ensure(bucketKey(row.barcode));
          b.gross_profit = row.grossProfit;
          b.profit_margin = row.profitMargin;
        }
      }
    }

    if (config.metrics.includes('listing_count')) {
      const listingCounts = await this.prisma.listing.groupBy({
        by: ['platform'],
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
      });
      for (const lc of listingCounts) {
        const key = primaryDim === 'platform' ? lc.platform : lc.platform;
        const b = ensure(bucketKey(key));
        b.listing_count = lc._count._all;
      }
    }

    for (const b of buckets.values()) {
      const orders = Number(b.orders ?? 0);
      const revenue = Number(b.revenue ?? 0);
      if (config.metrics.includes('avg_order_value') && orders > 0) {
        b.avg_order_value = Math.round((revenue / orders) * 100) / 100;
      }
      if (config.metrics.includes('turnover_rate') && revenue > 0) {
        const stockVal = Number(b.stock_value ?? 0);
        b.turnover_rate =
          stockVal > 0 ? Math.round((revenue / stockVal) * 100) / 100 : 0;
      }
    }

    const dimCol = primaryDim;
    const columns = [dimCol, ...config.metrics];
    const rows = [...buckets.values()]
      .slice(0, limit)
      .map((b) => {
        const row: Record<string, unknown> = { [dimCol]: b[primaryDim] };
        for (const m of config.metrics) {
          row[m] = b[m] ?? 0;
        }
        return row;
      });

    return {
      period: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        label: range.label,
      },
      metrics: config.metrics,
      dimensions: config.dimensions,
      columns,
      rows,
    };
  }

  async runReport(
    organizationId: string,
    configInput: ReportConfig,
    opts?: { preview?: boolean },
  ): Promise<ReportResult> {
    const config = { ...configInput, reportType: configInput.reportType };
    const preview = opts?.preview === true;
    if (preview) {
      return this.runReportUncached(organizationId, config, opts);
    }
    const digest = createHash('sha256')
      .update(JSON.stringify({ organizationId, config }))
      .digest('hex')
      .slice(0, 24);
    return this.reportsService.generateReport(
      organizationId,
      config.reportType,
      digest,
      () => this.runReportUncached(organizationId, config, opts),
    );
  }

  private async runReportUncached(
    organizationId: string,
    configInput: ReportConfig,
    opts?: { preview?: boolean },
  ): Promise<ReportResult> {
    const config = { ...configInput, reportType: configInput.reportType };
    const preview = opts?.preview === true;
    const effectiveLimit = preview
      ? 10
      : config.limit ?? (preview ? 10 : 1000);

    switch (config.reportType) {
      case ReportType.ORDERS:
        return this.runOrdersReport(organizationId, config, effectiveLimit);
      case ReportType.PRODUCTS:
        return this.runProductsReport(organizationId, config, effectiveLimit);
      case ReportType.LISTINGS:
        return this.runListingsReport(organizationId, config, effectiveLimit);
      case ReportType.STOCK:
        return this.runStockReport(organizationId, config, effectiveLimit);
      case ReportType.PROFIT:
        return this.runProfitReport(organizationId, config, effectiveLimit);
      case ReportType.PLATFORM_COMPARISON:
        return this.runPlatformComparisonReport(organizationId, config);
      case ReportType.CUSTOM:
        throw new BadRequestException(
          'Özel (CUSTOM) rapor tipi henüz desteklenmiyor; ORDERS veya diğer tipleri seçin.',
        );
      default:
        throw new BadRequestException('Geçersiz rapor tipi');
    }
  }

  async saveReport(
    organizationId: string,
    userId: string,
    dto: SaveReportBodyDto,
  ): Promise<SavedReportListItem> {
    const merged = {
      ...(dto.config as unknown as Record<string, unknown>),
      reportType: dto.reportType,
    };
    const cfg = parseReportConfig(merged);
    const row = await this.prisma.savedReport.create({
      data: {
        organizationId,
        createdBy: userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        reportType: dto.reportType,
        config: cfg as unknown as Prisma.InputJsonValue,
        schedule:
          dto.schedule === undefined
            ? undefined
            : (dto.schedule as Prisma.InputJsonValue),
      },
      include: {
        creator: { select: { name: true, email: true } },
      },
    });
    return this.toListItem(row);
  }

  async listSavedReports(organizationId: string): Promise<SavedReportListItem[]> {
    const rows = await this.prisma.savedReport.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        creator: { select: { name: true, email: true } },
      },
    });
    return rows.map((r) => this.toListItem(r));
  }

  async deleteSavedReport(organizationId: string, id: string): Promise<void> {
    const res = await this.prisma.savedReport.deleteMany({
      where: { id, organizationId },
    });
    if (res.count === 0) {
      throw new NotFoundException('Kayıtlı rapor bulunamadı');
    }
  }

  async updateSchedule(
    organizationId: string,
    id: string,
    dto: { cron?: string | null; emails: string[]; format?: 'csv' | 'json'; frequency?: 'daily' | 'weekly' },
  ): Promise<SavedReportListItem> {
    if (dto.emails.length === 0) {
      return this.clearSchedule(organizationId, id);
    }
    const schedule = buildScheduleJson(dto);
    try {
      const row = await this.prisma.savedReport.update({
        where: { id, organizationId },
        data: { schedule },
        include: { creator: { select: { name: true, email: true } } },
      });
      return this.toListItem(row);
    } catch {
      throw new NotFoundException('Kayıtlı rapor bulunamadı');
    }
  }

  async clearSchedule(organizationId: string, id: string): Promise<SavedReportListItem> {
    try {
      const row = await this.prisma.savedReport.update({
        where: { id, organizationId },
        data: { schedule: Prisma.DbNull },
        include: { creator: { select: { name: true, email: true } } },
      });
      return this.toListItem(row);
    } catch {
      throw new NotFoundException('Kayıtlı rapor bulunamadı');
    }
  }

  async exportReport(
    organizationId: string,
    reportId: string,
    format: 'csv' | 'json',
  ): Promise<string> {
    const row = await this.prisma.savedReport.findFirst({
      where: { id: reportId, organizationId },
    });
    if (!row) {
      throw new NotFoundException('Kayıtlı rapor bulunamadı');
    }
    const config = parseReportConfig(row.config);
    const result = await this.runReport(organizationId, config);
    return this.formatExport(result, format, config);
  }

  async runSavedReport(
    organizationId: string,
    reportId: string,
    opts?: { preview?: boolean },
  ): Promise<ReportResult> {
    const row = await this.prisma.savedReport.findFirst({
      where: { id: reportId, organizationId },
    });
    if (!row) {
      throw new NotFoundException('Kayıtlı rapor bulunamadı');
    }
    const config = parseReportConfig(row.config);
    const result = await this.runReport(organizationId, config, opts);
    await this.prisma.savedReport.update({
      where: { id: reportId },
      data: { lastRunAt: new Date() },
    });
    return result;
  }

  async runScheduledReport(reportId: string): Promise<void> {
    const row = await this.prisma.savedReport.findUnique({
      where: { id: reportId },
    });
    if (!row) {
      this.logger.warn('Zamanlanmış rapor bulunamadı', { reportId });
      return;
    }
    const schedule = parseScheduleJson(row.schedule);
    if (!schedule || schedule.emails.length === 0) {
      return;
    }
    const config = parseReportConfig(row.config);
    const fmt = schedule.format ?? 'csv';
    const content = await this.exportReport(row.organizationId, reportId, fmt);
    const filename = `senkronize-rapor-${row.name.replace(/[^\w.-]+/g, '_')}.${fmt}`;
    const subject = `Senkronize zamanlanmış rapor: ${row.name}`;
    const html = `<p>Merhaba,</p><p><strong>${row.name}</strong> raporu ektedir.</p><p>Senkronize</p>`;
    for (const to of schedule.emails) {
      await this.notificationService.sendEmail({
        to,
        subject,
        html,
        attachments: [
          {
            filename,
            contentBase64: Buffer.from(content, 'utf-8').toString('base64'),
          },
        ],
      });
    }
    await this.prisma.savedReport.update({
      where: { id: reportId },
      data: { lastRunAt: new Date() },
    });
    this.logger.log('Zamanlanmış rapor gönderildi', {
      reportId,
      organizationId: row.organizationId,
      recipientCount: schedule.emails.length,
    });
  }

  private formatExport(
    result: ReportResult,
    format: 'csv' | 'json',
    config: ReportConfig,
  ): string {
    const visible = this.visibleColumns(result.columns, config);
    const rows = result.rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of visible) {
        const label = config.columnLabels?.[c] ?? c;
        o[label] = r[c];
      }
      return o;
    });
    if (format === 'json') {
      return JSON.stringify(rows, null, 2);
    }
    const headers = visible.map((c) => config.columnLabels?.[c] ?? c);
    const relabeled = rows.map((r, i) => {
      const o: Record<string, unknown> = {};
      visible.forEach((c, j) => {
        o[headers[j]!] = result.rows[i]![c];
      });
      return o;
    });
    return toCsv(relabeled, headers);
  }

  private visibleColumns(columns: string[], config: ReportConfig): string[] {
    return columns.filter((c) => !config.columnHidden?.[c]);
  }

  private toListItem(
    row: SavedReport & {
      creator: { name: string; email: string };
    },
  ): SavedReportListItem {
    const config = parseReportConfig(row.config);
    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      description: row.description,
      reportType: row.reportType,
      config,
      schedule: parseScheduleJson(row.schedule),
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdBy: row.createdBy,
      creatorName: row.creator.name,
      creatorEmail: row.creator.email,
    };
  }

  private pickOrderBy(
    reportType: ReportType,
    orderBy?: string,
  ): Record<string, 'asc' | 'desc'> | undefined {
    if (!orderBy) {
      return undefined;
    }
    if (reportType === ReportType.ORDERS) {
      if (!['platformCreatedAt', 'totalAmount', 'status'].includes(orderBy)) {
        return undefined;
      }
      return { [orderBy]: 'desc' };
    }
    if (reportType === ReportType.PRODUCTS) {
      if (!['createdAt', 'name', 'barcode'].includes(orderBy)) {
        return undefined;
      }
      return { [orderBy]: 'asc' };
    }
    if (reportType === ReportType.LISTINGS) {
      if (!['quantity', 'updatedAt', 'title'].includes(orderBy)) {
        return undefined;
      }
      return { [orderBy]: 'desc' };
    }
    if (reportType === ReportType.STOCK) {
      if (!['quantity', 'updatedAt', 'barcode'].includes(orderBy)) {
        return undefined;
      }
      return { [orderBy]: orderBy === 'barcode' ? 'asc' : 'desc' };
    }
    return undefined;
  }

  private mergeOrderWhere(
    base: Prisma.OrderWhereInput,
    filters: ReportFilter[],
  ): Prisma.OrderWhereInput {
    const parts: Prisma.OrderWhereInput[] = [];
    for (const f of filters) {
      if (!ORDER_FILTER_FIELDS.has(f.field)) {
        throw new BadRequestException(`Sipariş raporu için geçersiz filtre: ${f.field}`);
      }
      parts.push(this.orderFilterToWhere(f));
    }
    if (parts.length === 0) {
      return base;
    }
    const existingAnd = base.AND;
    const andArray = Array.isArray(existingAnd)
      ? existingAnd
      : existingAnd
        ? [existingAnd]
        : [];
    return { ...base, AND: [...andArray, ...parts] };
  }

  private orderFilterToWhere(f: ReportFilter): Prisma.OrderWhereInput {
    switch (f.field) {
      case 'status': {
        if (f.operator === 'eq') {
          return { status: parseOrderStatus(String(f.value)) };
        }
        if (f.operator === 'in' && Array.isArray(f.value)) {
          const st = f.value.map((v) => parseOrderStatus(String(v)));
          return { status: { in: st } };
        }
        throw new BadRequestException('Durum filtresi yalnızca eq veya in olabilir');
      }
      case 'platform': {
        if (f.operator === 'eq') {
          return { platform: parseMarketplace(String(f.value)) };
        }
        if (f.operator === 'in' && Array.isArray(f.value)) {
          return {
            platform: {
              in: f.value.map((v) => parseMarketplace(String(v))),
            },
          };
        }
        throw new BadRequestException('Platform filtresi yalnızca eq veya in olabilir');
      }
      case 'totalAmount': {
        const n = Number(f.value);
        if (!Number.isFinite(n)) {
          throw new BadRequestException('totalAmount sayısal olmalıdır');
        }
        if (f.operator === 'eq') {
          return { totalAmount: n };
        }
        if (f.operator === 'gt') {
          return { totalAmount: { gt: n } };
        }
        if (f.operator === 'lt') {
          return { totalAmount: { lt: n } };
        }
        throw new BadRequestException('totalAmount için desteklenmeyen operatör');
      }
      case 'customerName': {
        const s = String(f.value ?? '');
        if (f.operator === 'contains') {
          return { customerName: { contains: s, mode: 'insensitive' } };
        }
        if (f.operator === 'eq') {
          return { customerName: s };
        }
        throw new BadRequestException('Müşteri adı filtresi eq veya contains olmalıdır');
      }
      case 'currency': {
        if (f.operator !== 'eq') {
          throw new BadRequestException('Para birimi filtresi yalnızca eq olabilir');
        }
        return { currency: String(f.value) };
      }
      default:
        return {};
    }
  }

  private async runOrdersReport(
    organizationId: string,
    config: ReportConfig,
    limit: number,
  ): Promise<ReportResult> {
    const dr = parseDateRange(config.dateRange);
    const where: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      ...(dr && {
        platformCreatedAt: { gte: dr.from, lte: dr.to },
      }),
      ...(config.platforms &&
        config.platforms.length > 0 && {
          platform: {
            in: config.platforms.map((p) => parseMarketplace(p)),
          },
        }),
    };
    const merged = this.mergeOrderWhere(where, config.filters);
    const orderBy = this.pickOrderBy(ReportType.ORDERS, config.orderBy);
    const selectCols =
      config.columns.length > 0
        ? config.columns.filter((c) => ORDER_SELECT_FIELDS.has(c))
        : [...ORDER_SELECT_FIELDS];
    if (selectCols.length === 0) {
      throw new BadRequestException('Geçerli sipariş kolonu seçilmedi');
    }
    const select: Prisma.OrderSelect = {};
    for (const c of selectCols) {
      (select as Record<string, boolean>)[c] = true;
    }
    const dbRows = await this.prisma.order.findMany({
      where: merged,
      select,
      orderBy: orderBy ?? { platformCreatedAt: 'desc' },
      take: limit,
    });
    let plainRows: Record<string, unknown>[] = dbRows.map((r) =>
      serializeRow(r as unknown as Record<string, unknown>),
    );
    if (config.groupBy && selectCols.includes(config.groupBy)) {
      plainRows = this.groupRows(plainRows, config.groupBy, ['totalAmount']);
    }
    return {
      columns: plainRows.length > 0 ? Object.keys(plainRows[0]!) : [...selectCols],
      rows: plainRows,
    };
  }

  private groupRows(
    rows: Record<string, unknown>[],
    groupBy: string,
    sumKeys: string[],
  ): Record<string, unknown>[] {
    const map = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      const key = String(r[groupBy] ?? '');
      const cur = map.get(key) ?? { [groupBy]: r[groupBy], _count: 0 };
      cur._count = Number(cur._count) + 1;
      for (const sk of sumKeys) {
        const add = typeof r[sk] === 'number' ? (r[sk] as number) : Number(r[sk]);
        if (Number.isFinite(add)) {
          cur[sk] = Number(cur[sk] ?? 0) + add;
        }
      }
      map.set(key, cur);
    }
    return Array.from(map.values());
  }

  private mergeProductWhere(
    base: Prisma.ProductWhereInput,
    filters: ReportFilter[],
  ): Prisma.ProductWhereInput {
    const parts: Prisma.ProductWhereInput[] = [];
    for (const f of filters) {
      if (!PRODUCT_FILTER_FIELDS.has(f.field)) {
        throw new BadRequestException(`Ürün raporu için geçersiz filtre: ${f.field}`);
      }
      if (f.field === 'isActive') {
        if (f.operator !== 'eq') {
          throw new BadRequestException('isActive yalnızca eq ile filtrelenebilir');
        }
        parts.push({ isActive: Boolean(f.value) });
        continue;
      }
      if (f.field === 'name' || f.field === 'barcode' || f.field === 'brand' || f.field === 'category') {
        if (f.operator === 'contains') {
          parts.push({
            [f.field]: { contains: String(f.value), mode: 'insensitive' },
          } as Prisma.ProductWhereInput);
        } else if (f.operator === 'eq') {
          parts.push({ [f.field]: String(f.value) } as Prisma.ProductWhereInput);
        } else {
          throw new BadRequestException(`Alan ${f.field} için desteklenmeyen operatör`);
        }
        continue;
      }
    }
    if (parts.length === 0) {
      return base;
    }
    return { ...base, AND: parts };
  }

  private async runProductsReport(
    organizationId: string,
    config: ReportConfig,
    limit: number,
  ): Promise<ReportResult> {
    const where: Prisma.ProductWhereInput = {
      organizationId,
      deletedAt: null,
    };
    const merged = this.mergeProductWhere(where, config.filters);
    const orderBy = this.pickOrderBy(ReportType.PRODUCTS, config.orderBy);
    const selectCols =
      config.columns.length > 0
        ? config.columns.filter((c) => PRODUCT_SELECT_FIELDS.has(c))
        : [...PRODUCT_SELECT_FIELDS];
    if (selectCols.length === 0) {
      throw new BadRequestException('Geçerli ürün kolonu seçilmedi');
    }
    const select: Prisma.ProductSelect = {};
    for (const c of selectCols) {
      (select as Record<string, boolean>)[c] = true;
    }
    const dbRows = await this.prisma.product.findMany({
      where: merged,
      select,
      orderBy: orderBy ?? { name: 'asc' },
      take: limit,
    });
    let plainRows: Record<string, unknown>[] = dbRows.map((r) =>
      serializeRow(r as unknown as Record<string, unknown>),
    );
    if (config.groupBy && selectCols.includes(config.groupBy)) {
      plainRows = this.groupRows(plainRows, config.groupBy, []);
    }
    return {
      columns: plainRows.length > 0 ? Object.keys(plainRows[0]!) : [...selectCols],
      rows: plainRows,
    };
  }

  private mergeListingWhere(
    base: Prisma.ListingWhereInput,
    config: ReportConfig,
    filters: ReportFilter[],
  ): Prisma.ListingWhereInput {
    const parts: Prisma.ListingWhereInput[] = [];
    for (const f of filters) {
      if (!LISTING_FILTER_FIELDS.has(f.field)) {
        throw new BadRequestException(`Listeleme raporu için geçersiz filtre: ${f.field}`);
      }
      if (f.field === 'platform') {
        if (f.operator === 'eq') {
          parts.push({ platform: parseMarketplace(String(f.value)) });
        } else if (f.operator === 'in' && Array.isArray(f.value)) {
          parts.push({
            platform: { in: f.value.map((v) => parseMarketplace(String(v))) },
          });
        } else {
          throw new BadRequestException('platform filtresi eq veya in olmalıdır');
        }
        continue;
      }
      if (f.field === 'approved') {
        parts.push({ approved: Boolean(f.value) });
        continue;
      }
      if (f.field === 'quantity') {
        const n = Number(f.value);
        if (!Number.isFinite(n)) {
          throw new BadRequestException('quantity sayısal olmalıdır');
        }
        if (f.operator === 'eq') {
          parts.push({ quantity: n });
        } else if (f.operator === 'gt') {
          parts.push({ quantity: { gt: n } });
        } else if (f.operator === 'lt') {
          parts.push({ quantity: { lt: n } });
        } else {
          throw new BadRequestException('quantity için desteklenmeyen operatör');
        }
        continue;
      }
      if (f.field === 'title' || f.field === 'barcode') {
        if (f.operator === 'contains') {
          parts.push({
            [f.field]: { contains: String(f.value), mode: 'insensitive' },
          } as Prisma.ListingWhereInput);
        } else if (f.operator === 'eq') {
          parts.push({ [f.field]: String(f.value) } as Prisma.ListingWhereInput);
        }
      }
    }
    const platformWhere =
      config.platforms && config.platforms.length > 0
        ? { platform: { in: config.platforms.map((p) => parseMarketplace(p)) } }
        : {};
    return {
      ...base,
      ...platformWhere,
      ...(parts.length > 0 ? { AND: parts } : {}),
    };
  }

  private async runListingsReport(
    organizationId: string,
    config: ReportConfig,
    limit: number,
  ): Promise<ReportResult> {
    const where: Prisma.ListingWhereInput = {
      organizationId,
      deletedAt: null,
    };
    const merged = this.mergeListingWhere(where, config, config.filters);
    const orderBy = this.pickOrderBy(ReportType.LISTINGS, config.orderBy);
    const selectCols =
      config.columns.length > 0
        ? config.columns.filter((c) => LISTING_SELECT_FIELDS.has(c))
        : [...LISTING_SELECT_FIELDS];
    if (selectCols.length === 0) {
      throw new BadRequestException('Geçerli listeleme kolonu seçilmedi');
    }
    const select: Prisma.ListingSelect = {};
    for (const c of selectCols) {
      (select as Record<string, boolean>)[c] = true;
    }
    const dbRows = await this.prisma.listing.findMany({
      where: merged,
      select,
      orderBy: orderBy ?? { updatedAt: 'desc' },
      take: limit,
    });
    let plainRows: Record<string, unknown>[] = dbRows.map((r) =>
      serializeRow(r as unknown as Record<string, unknown>),
    );
    if (config.groupBy && selectCols.includes(config.groupBy)) {
      plainRows = this.groupRows(plainRows, config.groupBy, ['quantity', 'salePrice']);
    }
    return {
      columns: plainRows.length > 0 ? Object.keys(plainRows[0]!) : [...selectCols],
      rows: plainRows,
    };
  }

  private mergeStockWhere(
    base: Prisma.StockEntryWhereInput,
    filters: ReportFilter[],
  ): Prisma.StockEntryWhereInput {
    const parts: Prisma.StockEntryWhereInput[] = [];
    for (const f of filters) {
      if (!STOCK_FILTER_FIELDS.has(f.field)) {
        throw new BadRequestException(`Stok raporu için geçersiz filtre: ${f.field}`);
      }
      if (f.field === 'barcode') {
        if (f.operator === 'eq') {
          parts.push({ barcode: String(f.value) });
        } else if (f.operator === 'contains') {
          parts.push({ barcode: { contains: String(f.value), mode: 'insensitive' } });
        } else {
          throw new BadRequestException('Barkod filtresi eq veya contains olmalıdır');
        }
        continue;
      }
      if (f.field === 'warehouseId') {
        if (f.operator !== 'eq') {
          throw new BadRequestException('warehouseId yalnızca eq ile filtrelenebilir');
        }
        parts.push({ warehouseId: String(f.value) });
        continue;
      }
      if (f.field === 'platform') {
        if (f.value === null || f.value === 'null' || f.value === '') {
          parts.push({ platform: null });
        } else if (f.operator === 'eq') {
          parts.push({ platform: parseMarketplace(String(f.value)) });
        } else {
          throw new BadRequestException('Platform filtresi eq olmalıdır');
        }
        continue;
      }
      if (f.field === 'quantity') {
        const n = Number(f.value);
        if (!Number.isFinite(n)) {
          throw new BadRequestException('quantity sayısal olmalıdır');
        }
        if (f.operator === 'gt') {
          parts.push({ quantity: { gt: n } });
        } else if (f.operator === 'lt') {
          parts.push({ quantity: { lt: n } });
        } else if (f.operator === 'eq') {
          parts.push({ quantity: n });
        } else {
          throw new BadRequestException('quantity için desteklenmeyen operatör');
        }
      }
    }
    if (parts.length === 0) {
      return base;
    }
    return { ...base, AND: parts };
  }

  private async runStockReport(
    organizationId: string,
    config: ReportConfig,
    limit: number,
  ): Promise<ReportResult> {
    const where: Prisma.StockEntryWhereInput = {
      organizationId,
    };
    const merged = this.mergeStockWhere(where, config.filters);
    const platformExtra =
      config.platforms && config.platforms.length > 0
        ? { platform: { in: config.platforms.map((p) => parseMarketplace(p)) } }
        : {};
    const orderBy = this.pickOrderBy(ReportType.STOCK, config.orderBy);
    const selectCols =
      config.columns.length > 0
        ? config.columns.filter((c) => STOCK_ENTRY_SELECT_FIELDS.has(c))
        : [...STOCK_ENTRY_SELECT_FIELDS];
    if (selectCols.length === 0) {
      throw new BadRequestException('Geçerli stok kolonu seçilmedi');
    }
    const select: Prisma.StockEntrySelect = {};
    for (const c of selectCols) {
      (select as Record<string, boolean>)[c] = true;
    }
    const dbRows = await this.prisma.stockEntry.findMany({
      where: { ...merged, ...platformExtra },
      select,
      orderBy: orderBy ?? { updatedAt: 'desc' },
      take: limit,
    });
    let plainRows: Record<string, unknown>[] = dbRows.map((r) =>
      serializeRow(r as unknown as Record<string, unknown>),
    );
    if (config.groupBy && selectCols.includes(config.groupBy)) {
      plainRows = this.groupRows(plainRows, config.groupBy, ['quantity']);
    }
    return {
      columns: plainRows.length > 0 ? Object.keys(plainRows[0]!) : [...selectCols],
      rows: plainRows,
    };
  }

  private async runProfitReport(
    organizationId: string,
    config: ReportConfig,
    limit: number,
  ): Promise<ReportResult> {
    const dr = parseDateRange(config.dateRange);
    if (!dr) {
      throw new BadRequestException('Kâr raporu için tarih aralığı zorunludur');
    }
    const platform =
      config.platforms && config.platforms.length === 1
        ? parseMarketplace(config.platforms[0]!)
        : undefined;
    const data = await this.reportsService.getProfitReport(organizationId, {
      from: dr.from,
      to: dr.to,
      platform,
    });
    const byPlatformRows = data.byPlatform.map((r) =>
      serializeRow({
        platform: r.platform,
        revenue: r.revenue,
        orderCount: r.orderCount,
      }),
    );
    const topRows = data.topProducts.slice(0, limit).map((r) =>
      serializeRow({
        name: r.name,
        barcode: r.barcode,
        revenue: r.revenue,
        quantity: r.quantity,
      }),
    );
    const wantTop =
      config.columns.length > 0 &&
      config.columns.some((c) => ['name', 'barcode', 'quantity'].includes(c)) &&
      !config.columns.includes('platform');
    const rows = wantTop ? topRows : byPlatformRows;
    const defaultCols = wantTop
      ? ['name', 'barcode', 'revenue', 'quantity']
      : ['platform', 'revenue', 'orderCount'];
    const selectCols =
      config.columns.length > 0
        ? config.columns.filter((c) => defaultCols.includes(c))
        : defaultCols;
    const projected = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of selectCols) {
        o[c] = r[c];
      }
      return o;
    });
    return { columns: selectCols, rows: projected };
  }

  private async runPlatformComparisonReport(
    organizationId: string,
    config: ReportConfig,
  ): Promise<ReportResult> {
    const dr = parseDateRange(config.dateRange);
    if (!dr) {
      throw new BadRequestException('Platform karşılaştırması için tarih aralığı zorunludur');
    }
    const data = await this.reportsService.getPlatformComparison(organizationId, {
      from: dr.from,
      to: dr.to,
    });
    let rows = data.platforms.map((p) =>
      serializeRow({
        name: p.name,
        orderCount: p.orderCount,
        revenue: p.revenue,
        avgOrderValue: p.avgOrderValue,
        returnRate: p.returnRate,
        syncStatus: p.syncStatus,
      }),
    );
    if (config.platforms && config.platforms.length > 0) {
      const names = new Set(
        config.platforms.map((plat) => {
          try {
            const m = parseMarketplace(plat);
            return MARKETPLACE_LABEL_TR[m] ?? String(m);
          } catch {
            return plat;
          }
        }),
      );
      rows = rows.filter((r) => names.has(String(r.name)));
    }
    const defaultCols = [
      'name',
      'orderCount',
      'revenue',
      'avgOrderValue',
      'returnRate',
      'syncStatus',
    ];
    const selectCols =
      config.columns.length > 0
        ? config.columns.filter((c) => defaultCols.includes(c))
        : defaultCols;
    rows = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of selectCols) {
        o[c] = r[c];
      }
      return o;
    });
    return {
      columns: selectCols,
      rows,
    };
  }
}
