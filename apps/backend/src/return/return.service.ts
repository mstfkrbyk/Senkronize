import { InjectQueue } from '@nestjs/bull';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Marketplace,
  OrderStatus,
  Prisma,
  ReturnStatus,
  StockMovementType,
  type Return,
  type ReturnItem,
} from '@prisma/client';
import type { Queue } from 'bull';
import type { MarketplaceReturn } from '@senkronize/shared';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_MARKETPLACE_PULL, QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import type { MarketplacePullJobData, MarketplacePushJobData } from '../queue/queue.types';
import { StockMovementService } from '../stock/stock-movement.service';
import { WarehouseService } from '../warehouse/warehouse.service';

import type { ReturnQueryDto, UpdateReturnStatusDto } from './return.dto';

export interface ReturnListItemDto {
  id: string;
  organizationId: string;
  orderId: string;
  platform: Marketplace;
  platformReturnId: string | null;
  status: ReturnStatus;
  reason: string | null;
  refundAmount: string | null;
  refundStatus: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    platformOrderId: string;
    customerName: string;
    totalAmount: string;
    currency: string;
  };
  items: Array<{
    id: string;
    barcode: string;
    quantity: number;
    reason: string | null;
    condition: string | null;
    productName: string | null;
    thumbnailUrl: string | null;
  }>;
}

export interface ReturnDetailDto extends Omit<ReturnListItemDto, 'order'> {
  statusLog: Array<{ at: string; status: string; note?: string }>;
  order: ReturnListItemDto['order'] & {
    shippingAddress: string | null;
    customerPhone: string | null;
    platformCreatedAt: string;
    status: OrderStatus;
    items: Array<{
      barcode: string;
      productName: string | null;
      sku: string;
      quantity: number;
    }>;
  };
}

const STOCK_RESTORE_STATUSES: ReadonlySet<ReturnStatus> = new Set([
  ReturnStatus.RECEIVED,
  ReturnStatus.REFUNDED,
]);

@Injectable()
export class ReturnService {
  private readonly logger = new Logger(ReturnService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseService: WarehouseService,
    private readonly stockMovementService: StockMovementService,
    private readonly cache: CacheService,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly marketplacePullQueue: Queue<MarketplacePullJobData>,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue<MarketplacePushJobData>,
  ) {}

  async syncReturns(
    organizationId: string,
    connectionId: string,
  ): Promise<{ jobId: string }> {
    const conn = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: connectionId,
        organizationId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!conn) {
      throw new NotFoundException('Pazaryeri bağlantısı bulunamadı');
    }
    const job = await this.marketplacePullQueue.add(
      'pull-returns',
      {
        organizationId,
        platform: String(conn.platform),
        type: 'returns',
        connectionId: conn.id,
      },
      STANDARD_QUEUE_JOB_OPTIONS,
    );
    return { jobId: String(job.id) };
  }

  async upsertFromPlatform(
    organizationId: string,
    platform: Marketplace,
    rows: MarketplaceReturn[],
  ): Promise<{ upserted: number }> {
    let upserted = 0;
    for (const m of rows) {
      const order = await this.prisma.order.findFirst({
        where: {
          organizationId,
          platform,
          platformOrderId: m.platformOrderId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!order) {
        this.logger.warn('İade için sipariş bulunamadı, atlanıyor', {
          organizationId,
          platform,
          platformOrderId: m.platformOrderId,
        });
        continue;
      }
      const requestedAt = new Date(m.requestedAt);
      const start = new Date(requestedAt);
      start.setHours(0, 0, 0, 0);
      const end = new Date(requestedAt);
      end.setHours(23, 59, 59, 999);

      const existing = await this.prisma.return.findFirst({
        where: {
          organizationId,
          orderId: order.id,
          deletedAt: null,
          ...(m.platformReturnId
            ? { platformReturnId: m.platformReturnId }
            : {
                platformReturnId: null,
                requestedAt: { gte: start, lte: end },
              }),
        },
        include: { items: true },
      });

      const status = mapPlatformReturnStatus(m.status);
      const refundAmount =
        m.refundAmount !== undefined && Number.isFinite(m.refundAmount)
          ? new Prisma.Decimal(m.refundAmount)
          : null;

      if (existing) {
        const prevStatus = existing.status;
        const nextLog = this.mergeStatusLog(existing.statusLog, {
          at: new Date().toISOString(),
          status,
          note: 'Platform senkronu',
        });
        const mergedItems = m.items.map((it, i) => ({
          id: `sync-${existing.id}-${i}`,
          returnId: existing.id,
          barcode: it.barcode,
          quantity: Math.max(0, Math.round(it.quantity)),
          reason: it.reason ?? null,
          condition: it.condition ?? null,
        })) as ReturnItem[];
        await this.prisma.$transaction(async (tx) => {
          await tx.return.update({
            where: { id: existing.id },
            data: {
              status,
              reason: m.reason ?? null,
              refundAmount,
              refundStatus: m.refundStatus ?? null,
              resolvedAt: m.resolvedAt ? new Date(m.resolvedAt) : null,
              statusLog: nextLog,
              ...(m.platformReturnId && !existing.platformReturnId
                ? { platformReturnId: m.platformReturnId }
                : {}),
            },
          });
          await tx.returnItem.deleteMany({ where: { returnId: existing.id } });
          await tx.returnItem.createMany({
            data: m.items.map((it) => ({
              returnId: existing.id,
              barcode: it.barcode,
              quantity: Math.max(0, Math.round(it.quantity)),
              reason: it.reason ?? null,
              condition: it.condition ?? null,
            })),
          });
          await this.maybeRestoreReturnStock(
            tx,
            organizationId,
            existing.id,
            {
              ...existing,
              status,
              platform,
              items: mergedItems,
            },
            order.id,
            prevStatus,
          );
        });
      } else {
        const initialLog = this.mergeStatusLog(null, {
          at: requestedAt.toISOString(),
          status,
          note: 'Platform senkronu (oluşturuldu)',
        });
        await this.prisma.$transaction(async (tx) => {
          const created = await tx.return.create({
            data: {
              organizationId,
              orderId: order.id,
              platform,
              platformReturnId: m.platformReturnId ?? null,
              status,
              reason: m.reason ?? null,
              refundAmount,
              refundStatus: m.refundStatus ?? null,
              requestedAt,
              resolvedAt: m.resolvedAt ? new Date(m.resolvedAt) : null,
              statusLog: initialLog,
              items: {
                create: m.items.map((it) => ({
                  barcode: it.barcode,
                  quantity: Math.max(0, Math.round(it.quantity)),
                  reason: it.reason ?? null,
                  condition: it.condition ?? null,
                })),
              },
            },
            include: { items: true },
          });
          await this.maybeRestoreReturnStock(
            tx,
            organizationId,
            created.id,
            created,
            order.id,
            null,
          );
        });
      }
      upserted += 1;
    }
    if (rows.length > 0) {
      await this.cache.invalidateReportsForOrg(organizationId);
    }
    return { upserted };
  }

  async getReturns(
    organizationId: string,
    query: ReturnQueryDto,
  ): Promise<{ items: ReturnListItemDto[]; total: number }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const requestedAt: Prisma.DateTimeFilter = {};
    if (query.startDate) {
      requestedAt.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const e = new Date(query.endDate);
      e.setHours(23, 59, 59, 999);
      requestedAt.lte = e;
    }
    const where: Prisma.ReturnWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(Object.keys(requestedAt).length > 0 ? { requestedAt } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.return.findMany({
        where,
        include: {
          order: {
            select: {
              platformOrderId: true,
              customerName: true,
              totalAmount: true,
              currency: true,
              items: { select: { barcode: true, productName: true } },
            },
          },
          items: true,
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.return.count({ where }),
    ]);
    const thumbs = await this.loadThumbnailsForReturns(organizationId, rows);
    return {
      items: rows.map((r) => this.serializeListRow(r, thumbs)),
      total,
    };
  }

  async getReturnDetail(
    organizationId: string,
    id: string,
  ): Promise<ReturnDetailDto> {
    const row = await this.prisma.return.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        order: {
          select: {
            platformOrderId: true,
            customerName: true,
            totalAmount: true,
            currency: true,
            shippingAddress: true,
            customerPhone: true,
            platformCreatedAt: true,
            status: true,
            items: {
              select: { barcode: true, productName: true, sku: true, quantity: true },
            },
          },
        },
        items: true,
      },
    });
    if (!row) {
      throw new NotFoundException('İade bulunamadı');
    }
    const thumbs = await this.loadThumbnailsForReturns(organizationId, [row]);
    return this.serializeDetail(row, thumbs);
  }

  async approveReturn(organizationId: string, id: string): Promise<ReturnDetailDto> {
    const row = await this.requireReturn(organizationId, id);
    if (
      row.status === ReturnStatus.REJECTED ||
      row.status === ReturnStatus.REFUNDED ||
      row.status === ReturnStatus.COMPLETED
    ) {
      throw new ConflictException('Bu iade durumu için onay verilemez');
    }
    const nextLog = this.mergeStatusLog(row.statusLog, {
      at: new Date().toISOString(),
      status: ReturnStatus.APPROVED,
      note: 'Panel onayı',
    });
    await this.prisma.return.update({
      where: { id: row.id },
      data: {
        status: ReturnStatus.APPROVED,
        statusLog: nextLog,
      },
    });
    if (row.platformReturnId) {
      await this.marketplacePushQueue.add(
        'push-return-action',
        {
          organizationId,
          platform: String(row.platform),
          type: 'return-action',
          resourceIds: [row.id],
          payload: { action: 'approve' },
        },
        STANDARD_QUEUE_JOB_OPTIONS,
      );
    }
    await this.cache.invalidateReportsForOrg(organizationId);
    return this.getReturnDetail(organizationId, id);
  }

  async rejectReturn(
    organizationId: string,
    id: string,
    reason: string,
  ): Promise<ReturnDetailDto> {
    const row = await this.requireReturn(organizationId, id);
    if (
      row.status === ReturnStatus.REFUNDED ||
      row.status === ReturnStatus.COMPLETED ||
      row.status === ReturnStatus.REJECTED
    ) {
      throw new ConflictException('Bu iade zaten sonuçlandırılmış');
    }
    const nextLog = this.mergeStatusLog(row.statusLog, {
      at: new Date().toISOString(),
      status: ReturnStatus.REJECTED,
      note: reason,
    });
    await this.prisma.return.update({
      where: { id: row.id },
      data: {
        status: ReturnStatus.REJECTED,
        resolvedAt: new Date(),
        notes: reason,
        statusLog: nextLog,
      },
    });
    if (row.platformReturnId) {
      await this.marketplacePushQueue.add(
        'push-return-action',
        {
          organizationId,
          platform: String(row.platform),
          type: 'return-action',
          resourceIds: [row.id],
          payload: { action: 'reject', reason },
        },
        STANDARD_QUEUE_JOB_OPTIONS,
      );
    }
    await this.cache.invalidateReportsForOrg(organizationId);
    return this.getReturnDetail(organizationId, id);
  }

  async updateReturnStatus(
    organizationId: string,
    id: string,
    dto: UpdateReturnStatusDto,
  ): Promise<ReturnDetailDto> {
    const row = await this.requireReturn(organizationId, id);
    const prev = row.status;
    const nextLog = this.mergeStatusLog(row.statusLog, {
      at: new Date().toISOString(),
      status: dto.status,
      note: dto.notes,
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.return.update({
        where: { id: row.id },
        data: {
          status: dto.status,
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.status === ReturnStatus.REJECTED ||
          dto.status === ReturnStatus.REFUNDED ||
          dto.status === ReturnStatus.COMPLETED
            ? { resolvedAt: new Date() }
            : {}),
          statusLog: nextLog,
        },
      });
      const updated = await tx.return.findFirstOrThrow({
        where: { id: row.id },
        include: { items: true },
      });
      await this.maybeRestoreReturnStock(
        tx,
        organizationId,
        row.id,
        { ...updated, platform: row.platform },
        row.orderId,
        prev,
      );
    });
    await this.cache.invalidateReportsForOrg(organizationId);
    return this.getReturnDetail(organizationId, id);
  }

  private async requireReturn(
    organizationId: string,
    id: string,
  ): Promise<Return & { items: ReturnItem[]; platform: Marketplace; orderId: string }> {
    const row = await this.prisma.return.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!row) {
      throw new NotFoundException('İade bulunamadı');
    }
    return row;
  }

  private mergeStatusLog(
    current: Prisma.JsonValue | null | undefined,
    entry: { at: string; status: string; note?: string },
  ): Prisma.InputJsonValue {
    const arr: unknown[] = Array.isArray(current) ? [...current] : [];
    arr.push(entry);
    return arr as Prisma.InputJsonValue;
  }

  private parseStatusLog(
    log: Prisma.JsonValue | null | undefined,
  ): Array<{ at: string; status: string; note?: string }> {
    if (!Array.isArray(log)) {
      return [];
    }
    const out: Array<{ at: string; status: string; note?: string }> = [];
    for (const raw of log) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        continue;
      }
      const o = raw as Record<string, unknown>;
      const at = typeof o.at === 'string' ? o.at : '';
      const status = typeof o.status === 'string' ? o.status : '';
      const note = typeof o.note === 'string' ? o.note : undefined;
      if (at.length > 0 && status.length > 0) {
        out.push(note !== undefined ? { at, status, note } : { at, status });
      }
    }
    return out;
  }

  private async maybeRestoreReturnStock(
    tx: Prisma.TransactionClient,
    organizationId: string,
    returnId: string,
    ret: Return & { items: ReturnItem[] },
    orderId: string,
    previousStatus: ReturnStatus | null,
  ): Promise<void> {
    const fresh = await tx.return.findFirst({
      where: { id: returnId },
      select: { stockRestoredAt: true, status: true, platform: true },
    });
    if (!fresh || fresh.stockRestoredAt) {
      return;
    }
    if (!STOCK_RESTORE_STATUSES.has(fresh.status)) {
      return;
    }
    if (previousStatus !== null && STOCK_RESTORE_STATUSES.has(previousStatus)) {
      return;
    }
    const wh = await this.warehouseService.getOrCreateMainWarehouse(organizationId);
    for (const item of ret.items) {
      const qty = Math.max(0, item.quantity);
      if (qty === 0) {
        continue;
      }
      const existing = await tx.stockEntry.findUnique({
        where: {
          organizationId_barcode_platform_warehouseId: {
            organizationId,
            barcode: item.barcode,
            platform: fresh.platform,
            warehouseId: wh.id,
          },
        },
      });
      const before = existing?.quantity ?? 0;
      const after = before + qty;
      await tx.stockEntry.upsert({
        where: {
          organizationId_barcode_platform_warehouseId: {
            organizationId,
            barcode: item.barcode,
            platform: fresh.platform,
            warehouseId: wh.id,
          },
        },
        create: {
          organizationId,
          warehouseId: wh.id,
          barcode: item.barcode,
          platform: fresh.platform,
          quantity: qty,
          reservedQty: 0,
        },
        update: {
          quantity: { increment: qty },
        },
      });
      await this.stockMovementService.record({
        organizationId,
        barcode: item.barcode,
        warehouseId: wh.id,
        platform: String(fresh.platform),
        movementType: StockMovementType.RETURN,
        quantity: qty,
        beforeQuantity: before,
        afterQuantity: after,
        orderId,
        note: 'İade stok girişi',
        tx,
      });
    }
    await tx.return.update({
      where: { id: returnId },
      data: { stockRestoredAt: new Date() },
    });
  }

  private async loadThumbnailsForReturns(
    organizationId: string,
    rows: Array<{
      platform: Marketplace;
      items: ReturnItem[];
    }>,
  ): Promise<Map<string, string | null>> {
    const orFilters: Prisma.ListingWhereInput[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      for (const it of r.items) {
        const k = `${r.platform}:${it.barcode}`;
        if (seen.has(k)) {
          continue;
        }
        seen.add(k);
        orFilters.push({ platform: r.platform, barcode: it.barcode });
      }
    }
    if (orFilters.length === 0) {
      return new Map();
    }
    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: orFilters,
      },
      select: { platform: true, barcode: true, imageUrls: true },
    });
    const map = new Map<string, string | null>();
    for (const row of listings) {
      const first = row.imageUrls?.[0];
      map.set(
        `${row.platform}:${row.barcode}`,
        typeof first === 'string' ? first : null,
      );
    }
    return map;
  }

  private serializeListRow(
    row: Return & {
      items: ReturnItem[];
      order: {
        platformOrderId: string;
        customerName: string;
        totalAmount: Prisma.Decimal;
        currency: string;
        items: Array<{ barcode: string; productName: string | null }>;
      };
    },
    thumbs: Map<string, string | null>,
  ): ReturnListItemDto {
    const nameByBarcode = new Map(
      row.order.items.map((i) => [i.barcode, i.productName]),
    );
    return {
      id: row.id,
      organizationId: row.organizationId,
      orderId: row.orderId,
      platform: row.platform,
      platformReturnId: row.platformReturnId,
      status: row.status,
      reason: row.reason,
      refundAmount: row.refundAmount?.toString() ?? null,
      refundStatus: row.refundStatus,
      requestedAt: row.requestedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      order: {
        platformOrderId: row.order.platformOrderId,
        customerName: row.order.customerName,
        totalAmount: row.order.totalAmount.toString(),
        currency: row.order.currency,
      },
      items: row.items.map((it) => ({
        id: it.id,
        barcode: it.barcode,
        quantity: it.quantity,
        reason: it.reason,
        condition: it.condition,
        productName: nameByBarcode.get(it.barcode) ?? null,
        thumbnailUrl: thumbs.get(`${row.platform}:${it.barcode}`) ?? null,
      })),
    };
  }

  private serializeDetail(
    row: Return & {
      items: ReturnItem[];
      order: {
        platformOrderId: string;
        customerName: string;
        totalAmount: Prisma.Decimal;
        currency: string;
        shippingAddress: string | null;
        customerPhone: string | null;
        platformCreatedAt: Date;
        status: OrderStatus;
        items: Array<{
          barcode: string;
          productName: string | null;
          sku: string;
          quantity: number;
        }>;
      };
    },
    thumbs: Map<string, string | null>,
  ): ReturnDetailDto {
    const base = this.serializeListRow(row, thumbs);
    const statusLog = this.parseStatusLog(row.statusLog);
    return {
      ...base,
      statusLog,
      order: {
        ...base.order,
        shippingAddress: row.order.shippingAddress,
        customerPhone: row.order.customerPhone,
        platformCreatedAt: row.order.platformCreatedAt.toISOString(),
        status: row.order.status,
        items: row.order.items,
      },
    };
  }
}

function mapPlatformReturnStatus(raw: string): ReturnStatus {
  const u = raw.trim().toUpperCase().replace(/\s+/g, '_');
  const map: Record<string, ReturnStatus> = {
    REQUESTED: ReturnStatus.REQUESTED,
    APPROVED: ReturnStatus.APPROVED,
    IN_TRANSIT: ReturnStatus.IN_TRANSIT,
    INTRANSIT: ReturnStatus.IN_TRANSIT,
    RECEIVED: ReturnStatus.RECEIVED,
    REFUNDED: ReturnStatus.REFUNDED,
    REJECTED: ReturnStatus.REJECTED,
    COMPLETED: ReturnStatus.COMPLETED,
    PENDING: ReturnStatus.REQUESTED,
    WAITING: ReturnStatus.REQUESTED,
  };
  return map[u] ?? ReturnStatus.REQUESTED;
}
