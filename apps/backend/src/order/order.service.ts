import { InjectQueue } from '@nestjs/bull';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CargoProvider,
  Marketplace,
  OrderStatus,
  Prisma,
  type Order,
  type OrderItem,
} from '@prisma/client';
import type { MarketplaceOrder } from '@senkronize/shared';
import type { Queue } from 'bull';

import { CacheKeys } from '../common/cache/cache-keys';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';
import { InvoiceService } from '../invoice/invoice.service';
import { OutboundWebhookService } from '../webhook/outbound-webhook.service';
import { resolveOrderWebhookEvents } from '../webhook/order-webhook-events.util';
import { WarehouseService } from '../warehouse/warehouse.service';

import type { OrderQueryDto, OrderSummaryDto, UpdateOrderStatusDto } from './order.dto';
import type { BulkResult, SerializedOrderNote } from './order.types';

export type SerializedOrderItem = Omit<OrderItem, 'unitPrice'> & {
  unitPrice: string;
  thumbnailUrl?: string | null;
};

export type SerializedOrder = Omit<
  Order,
  'totalAmount' | 'cancellationRequestedAt' | 'cancellationRequestNote'
> & {
  totalAmount: string;
  items: SerializedOrderItem[];
  cancellationRequestedAt: string | null;
  cancellationRequestNote: string | null;
};

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly warehouseService: WarehouseService,
    private readonly outboundWebhookService: OutboundWebhookService,
    private readonly invoiceService: InvoiceService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue<MarketplacePushJobData>,
  ) {}

  async findAll(
    organizationId: string,
    query: OrderQueryDto,
  ): Promise<{ items: SerializedOrder[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const platformCreatedAt: Prisma.DateTimeFilter = {};
    if (query.startDate) {
      platformCreatedAt.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      platformCreatedAt.lte = end;
    }

    const platformFilter: Prisma.OrderWhereInput =
      query.platforms && query.platforms.length > 0
        ? { platform: { in: query.platforms } }
        : query.platform
          ? { platform: query.platform }
          : {};

    const statusFilter: Prisma.OrderWhereInput =
      query.statuses && query.statuses.length > 0
        ? { status: { in: query.statuses } }
        : query.status
          ? { status: query.status }
          : {};

    const cargoFilter: Prisma.OrderWhereInput =
      query.cargoProvider && query.cargoProvider.trim().length > 0
        ? {
            cargoProvider: {
              contains: query.cargoProvider.trim(),
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {};

    const amountFilter: Prisma.DecimalFilter = {};
    if (query.minTotal !== undefined) {
      amountFilter.gte = new Prisma.Decimal(query.minTotal);
    }
    if (query.maxTotal !== undefined) {
      amountFilter.lte = new Prisma.Decimal(query.maxTotal);
    }
    const totalAmountFilter: Prisma.OrderWhereInput =
      Object.keys(amountFilter).length > 0 ? { totalAmount: amountFilter } : {};

    const where: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      ...platformFilter,
      ...statusFilter,
      ...cargoFilter,
      ...totalAmountFilter,
      ...(Object.keys(platformCreatedAt).length > 0 && {
        platformCreatedAt,
      }),
      ...(query.search && {
        OR: [
          {
            customerName: {
              contains: query.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          { platformOrderId: { contains: query.search } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          _count: { select: { items: true } },
        },
        orderBy: { platformCreatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    const thumbnailByKey = await this.loadThumbnailsForOrdersPage(
      organizationId,
      rows,
    );

    return {
      items: rows.map((o) => this.serializeOrder(o, thumbnailByKey)),
      total,
    };
  }

  private async loadThumbnailsForOrdersPage(
    organizationId: string,
    orders: (Order & { items: OrderItem[] })[],
  ): Promise<Map<string, string | null>> {
    const orFilters: Prisma.ListingWhereInput[] = [];
    const seen = new Set<string>();
    for (const o of orders) {
      for (const i of o.items) {
        const k = `${o.platform}:${i.barcode}`;
        if (seen.has(k)) {
          continue;
        }
        seen.add(k);
        orFilters.push({ platform: o.platform, barcode: i.barcode });
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

  private async loadItemThumbnails(
    organizationId: string,
    platform: Marketplace,
    items: OrderItem[],
  ): Promise<Map<string, string | null>> {
    const barcodes = [
      ...new Set(
        items
          .map((i) => i.barcode)
          .filter((b): b is string => typeof b === 'string' && b.length > 0),
      ),
    ];
    if (barcodes.length === 0) {
      return new Map();
    }
    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId,
        platform,
        deletedAt: null,
        barcode: { in: barcodes },
      },
      select: { barcode: true, imageUrls: true },
    });
    const map = new Map<string, string | null>();
    for (const row of listings) {
      const first = row.imageUrls?.[0];
      map.set(
        `${platform}:${row.barcode}`,
        typeof first === 'string' ? first : null,
      );
    }
    return map;
  }

  async findOne(organizationId: string, id: string): Promise<SerializedOrder> {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }
    const thumbnails = await this.loadItemThumbnails(
      organizationId,
      order.platform,
      order.items,
    );
    return this.serializeOrder(order, thumbnails);
  }

  async bulkAssignCargo(
    organizationId: string,
    orderIds: string[],
    cargoProvider: CargoProvider,
  ): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };
    const providerValue = String(cargoProvider);

    for (const id of orderIds) {
      try {
        const row = await this.prisma.order.findFirst({
          where: { id, organizationId, deletedAt: null },
        });
        if (!row) {
          result.failed += 1;
          result.errors.push({ id, message: 'Sipariş bulunamadı' });
          continue;
        }
        await this.prisma.order.update({
          where: { id },
          data: { cargoProvider: providerValue },
        });
        result.success += 1;
      } catch {
        result.failed += 1;
        result.errors.push({ id, message: 'Kargo firması atanamadı' });
      }
    }

    if (result.success > 0) {
      await this.cache.invalidateReportsForOrg(organizationId);
    }
    return result;
  }

  async bulkShip(
    organizationId: string,
    items: {
      orderId: string;
      trackingNumber?: string;
      cargoProvider?: CargoProvider;
    }[],
  ): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };

    for (const item of items) {
      try {
        const existing = await this.prisma.order.findFirst({
          where: { id: item.orderId, organizationId, deletedAt: null },
        });
        if (!existing) {
          result.failed += 1;
          result.errors.push({ id: item.orderId, message: 'Sipariş bulunamadı' });
          continue;
        }

        const trimmedTracking = item.trackingNumber?.trim() ?? '';
        const data: Prisma.OrderUpdateInput = {
          ...(item.cargoProvider !== undefined && {
            cargoProvider: String(item.cargoProvider),
          }),
          ...(trimmedTracking.length > 0 && {
            cargoTrackingNumber: trimmedTracking,
          }),
        };

        if (
          existing.status !== OrderStatus.SHIPPED &&
          existing.status !== OrderStatus.DELIVERED
        ) {
          data.status = OrderStatus.SHIPPED;
        }

        const updated = await this.prisma.order.update({
          where: { id: item.orderId },
          data,
        });

        if (existing.status !== updated.status) {
          this.dispatchOrderWebhooks(organizationId, {
            isCreate: false,
            prevStatus: existing.status,
            newStatus: updated.status,
            orderId: item.orderId,
          });
        }

        result.success += 1;
      } catch {
        result.failed += 1;
        result.errors.push({ id: item.orderId, message: 'Kargoya verilemedi' });
      }
    }

    if (result.success > 0) {
      await this.cache.invalidateReportsForOrg(organizationId);
    }
    return result;
  }

  async bulkInvoice(organizationId: string, orderIds: string[]): Promise<Buffer> {
    return this.invoiceService.generateBulkInvoicePdf(orderIds, organizationId);
  }

  async bulkUpdateStatus(
    organizationId: string,
    orderIds: string[],
    status: OrderStatus,
  ): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };

    for (const id of orderIds) {
      try {
        const existing = await this.prisma.order.findFirst({
          where: { id, organizationId, deletedAt: null },
        });
        if (!existing) {
          result.failed += 1;
          result.errors.push({ id, message: 'Sipariş bulunamadı' });
          continue;
        }
        await this.prisma.order.update({
          where: { id },
          data: { status },
        });
        if (existing.status !== status) {
          this.dispatchOrderWebhooks(organizationId, {
            isCreate: false,
            prevStatus: existing.status,
            newStatus: status,
            orderId: id,
          });
        }
        result.success += 1;
      } catch {
        result.failed += 1;
        result.errors.push({ id, message: 'Durum güncellenemedi' });
      }
    }

    if (result.success > 0) {
      await this.cache.invalidateReportsForOrg(organizationId);
    }
    return result;
  }

  async addTrackingNumber(
    organizationId: string,
    orderId: string,
    trackingNumber: string,
    cargoProvider: CargoProvider,
  ): Promise<SerializedOrder> {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    const trimmed = trackingNumber.trim();
    const data: Prisma.OrderUpdateInput = {
      cargoTrackingNumber: trimmed.length > 0 ? trimmed : null,
      cargoProvider: String(cargoProvider),
    };

    if (
      existing.status !== OrderStatus.SHIPPED &&
      existing.status !== OrderStatus.DELIVERED
    ) {
      data.status = OrderStatus.SHIPPED;
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data,
      include: { items: true },
    });

    if (existing.status !== updated.status) {
      this.dispatchOrderWebhooks(organizationId, {
        isCreate: false,
        prevStatus: existing.status,
        newStatus: updated.status,
        orderId,
      });
    }
    await this.cache.invalidateReportsForOrg(organizationId);
    const thumbnails = await this.loadItemThumbnails(
      organizationId,
      updated.platform,
      updated.items,
    );
    return this.serializeOrder(updated, thumbnails);
  }

  async addOrderNote(
    organizationId: string,
    orderId: string,
    userId: string,
    note: string,
    isInternal: boolean,
  ): Promise<SerializedOrderNote> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    const content = note.trim();
    if (content.length === 0) {
      throw new ConflictException('Not içeriği boş olamaz');
    }

    const row = await this.prisma.orderNote.create({
      data: {
        orderId,
        userId,
        content,
        isInternal,
      },
      include: { user: { select: { name: true } } },
    });

    return this.serializeOrderNote(row);
  }

  async getOrderNotes(
    organizationId: string,
    orderId: string,
  ): Promise<SerializedOrderNote[]> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    const rows = await this.prisma.orderNote.findMany({
      where: { orderId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.serializeOrderNote(row));
  }

  private serializeOrderNote(
    row: {
      id: string;
      orderId: string;
      userId: string;
      content: string;
      isInternal: boolean;
      createdAt: Date;
      user: { name: string };
    },
  ): SerializedOrderNote {
    return {
      id: row.id,
      orderId: row.orderId,
      userId: row.userId,
      userName: row.user.name,
      content: row.content,
      isInternal: row.isInternal,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdateOrderStatusDto,
  ): Promise<SerializedOrder> {
    const existing = await this.prisma.order.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    const data: Prisma.OrderUpdateInput = {
      status: dto.status,
      ...(dto.cargoTrackingNumber !== undefined && {
        cargoTrackingNumber: dto.cargoTrackingNumber || null,
      }),
      ...(dto.cargoProvider !== undefined && {
        cargoProvider: dto.cargoProvider || null,
      }),
    };

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      include: { items: true },
    });
    if (existing.status !== dto.status) {
      this.dispatchOrderWebhooks(organizationId, {
        isCreate: false,
        prevStatus: existing.status,
        newStatus: dto.status,
        orderId: id,
      });
    }
    await this.cache.invalidateReportsForOrg(organizationId);
    const thumbnails = await this.loadItemThumbnails(
      organizationId,
      updated.platform,
      updated.items,
    );
    return this.serializeOrder(updated, thumbnails);
  }

  private dispatchOrderWebhooks(
    organizationId: string,
    options: {
      isCreate: boolean;
      prevStatus?: OrderStatus;
      newStatus: OrderStatus;
      orderId: string;
      order?: Record<string, unknown>;
    },
  ): void {
    const events = resolveOrderWebhookEvents({
      isCreate: options.isCreate,
      prevStatus: options.prevStatus,
      newStatus: options.newStatus,
    });
    const basePayload: Record<string, unknown> = options.order ?? {
      orderId: options.orderId,
      status: options.newStatus,
    };
    for (const event of events) {
      void this.outboundWebhookService.dispatch(organizationId, event, basePayload);
    }
  }

  async upsertFromPlatform(
    organizationId: string,
    platform: Marketplace,
    orders: MarketplaceOrder[],
  ): Promise<{ createdOrders: Order[] }> {
    if (orders.length === 0) {
      return { createdOrders: [] };
    }

    const platformOrderIds = [...new Set(orders.map((o) => o.platformOrderId))];
    const preExistingRows =
      platformOrderIds.length > 0
        ? await this.prisma.order.findMany({
            where: {
              organizationId,
              platform,
              platformOrderId: { in: platformOrderIds },
              deletedAt: null,
            },
            select: { platformOrderId: true, status: true },
          })
        : [];
    const preExistingSet = new Set(
      preExistingRows.map((r) => r.platformOrderId),
    );
    const prevStatusByPlatformOrderId = new Map(
      preExistingRows.map((r) => [r.platformOrderId, r.status]),
    );
    const countedCreated = new Set<string>();
    const createdOrders: Order[] = [];

    const chunkSize = 12;
    for (let i = 0; i < orders.length; i += chunkSize) {
      const chunk = orders.slice(i, i + chunkSize);
      const rows = await Promise.all(
        chunk.map((o) =>
          this.prisma.order.upsert({
            where: {
              organizationId_platform_platformOrderId: {
                organizationId,
                platform,
                platformOrderId: o.platformOrderId,
              },
            },
            create: {
              organizationId,
              platform,
              platformOrderId: o.platformOrderId,
              status: mapPlatformStatus(o.status),
              customerName: o.customerName,
              totalAmount: o.totalAmount,
              currency: o.currency ?? 'TRY',
              cargoTrackingNumber: o.cargoTrackingNumber ?? null,
              cargoProvider: o.cargoProvider ?? null,
              platformCreatedAt: new Date(o.createdAt),
              items: {
                create: o.items.map((item) => ({
                  organizationId,
                  sku: item.sku,
                  barcode: item.barcode,
                  productName: item.productName ?? null,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  platformItemId: item.platformItemId,
                })),
              },
            },
            update: {
              status: mapPlatformStatus(o.status),
              cargoTrackingNumber: o.cargoTrackingNumber ?? null,
              cargoProvider: o.cargoProvider ?? null,
              syncedAt: new Date(),
            },
          }),
        ),
      );

      for (let j = 0; j < chunk.length; j++) {
        const o = chunk[j]!;
        const row = rows[j]!;
        const wasInDb = preExistingSet.has(o.platformOrderId);
        if (!wasInDb && !countedCreated.has(o.platformOrderId)) {
          createdOrders.push(row);
          countedCreated.add(o.platformOrderId);
          this.dispatchOrderWebhooks(organizationId, {
            isCreate: true,
            newStatus: row.status,
            orderId: row.id,
            order: {
              id: row.id,
              platform: row.platform,
              platformOrderId: row.platformOrderId,
              status: row.status,
              customerName: row.customerName,
              totalAmount: row.totalAmount.toString(),
              currency: row.currency,
            },
          });
        } else if (wasInDb) {
          const prevStatus = prevStatusByPlatformOrderId.get(o.platformOrderId);
          if (prevStatus !== undefined && prevStatus !== row.status) {
            this.dispatchOrderWebhooks(organizationId, {
              isCreate: false,
              prevStatus,
              newStatus: row.status,
              orderId: row.id,
            });
          }
        }
      }
    }

    await Promise.all([
      this.cache.invalidateReportsForOrg(organizationId),
      this.cache.delPattern(`${CacheKeys.dashboard(organizationId)}*`),
    ]);
    return { createdOrders };
  }

  /**
   * Trendyol webhook vb. platform olaylarından gelen durum güncellemesi.
   */
  async updateStatusFromPlatform(
    organizationId: string,
    platform: Marketplace,
    platformOrderId: string,
    platformStatus: string,
  ): Promise<void> {
    const status = mapPlatformStatus(platformStatus);
    const before = await this.prisma.order.findFirst({
      where: {
        organizationId,
        platform,
        platformOrderId,
        deletedAt: null,
      },
      select: { id: true, status: true },
    });
    await this.prisma.order.updateMany({
      where: {
        organizationId,
        platform,
        platformOrderId,
        deletedAt: null,
      },
      data: { status, syncedAt: new Date() },
    });
    if (before && before.status !== status) {
      this.dispatchOrderWebhooks(organizationId, {
        isCreate: false,
        prevStatus: before.status,
        newStatus: status,
        orderId: before.id,
      });
    }
    await this.cache.invalidateReportsForOrg(organizationId);
  }

  async getSummary(organizationId: string): Promise<OrderSummaryDto> {
    const baseWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayOrders, pendingOrders, revenueAgg, byPlatform, byStatus] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            ...baseWhere,
            platformCreatedAt: { gte: startOfToday },
          },
        }),
        this.prisma.order.count({
          where: {
            ...baseWhere,
            status: {
              in: [
                OrderStatus.NEW,
                OrderStatus.PICKING,
                OrderStatus.INVOICED,
              ],
            },
          },
        }),
        this.prisma.order.aggregate({
          where: {
            ...baseWhere,
            status: {
              in: [OrderStatus.DELIVERED, OrderStatus.SHIPPED],
            },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.groupBy({
          by: ['platform'],
          where: baseWhere,
          _count: { _all: true },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          where: baseWhere,
          _count: { _all: true },
        }),
      ]);

    const totalRevenue = revenueAgg._sum.totalAmount
      ? Number(revenueAgg._sum.totalAmount)
      : 0;

    const byPlatformRecord: Record<string, number> = {};
    for (const row of byPlatform) {
      byPlatformRecord[row.platform] = row._count._all;
    }

    const byStatusRecord: Record<string, number> = {};
    for (const row of byStatus) {
      byStatusRecord[row.status] = row._count._all;
    }

    return {
      todayOrders,
      pendingOrders,
      totalRevenue,
      byPlatform: byPlatformRecord,
      byStatus: byStatusRecord,
    };
  }

  async requestOrderCancellation(
    organizationId: string,
    orderId: string,
    note?: string,
  ): Promise<SerializedOrder> {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('Sipariş bulunamadı');
    }
    if (existing.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Sipariş zaten iptal edilmiş');
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        cancellationRequestedAt: new Date(),
        cancellationRequestNote: note?.trim() || null,
      },
      include: { items: true },
    });
    const thumbnails = await this.loadItemThumbnails(
      organizationId,
      updated.platform,
      updated.items,
    );
    return this.serializeOrder(updated, thumbnails);
  }

  async cancelOrder(
    organizationId: string,
    orderId: string,
    reason?: string,
  ): Promise<{ jobId: string }> {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
      select: { id: true, platform: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Sipariş bulunamadı');
    }
    if (existing.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Sipariş zaten iptal edilmiş');
    }
    const job = await this.marketplacePushQueue.add(
      'push-order-cancel',
      {
        organizationId,
        platform: String(existing.platform),
        type: 'order-cancel',
        resourceIds: [orderId],
        payload: { reason: reason ?? '' },
      },
      STANDARD_QUEUE_JOB_OPTIONS,
    );
    return { jobId: String(job.id) };
  }

  /**
   * Kuyruk işi: platform iptal bildiriminden sonra yerel iptal ve rezervasyon serbest bırakma.
   */
  async finalizeOrderCancellationFromJob(
    organizationId: string,
    orderId: string,
  ): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!order || order.status === OrderStatus.CANCELLED) {
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await this.releaseReservedForOrderTx(tx, organizationId, order);
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancellationRequestedAt: null,
          cancellationRequestNote: null,
        },
      });
    });
    await this.cache.invalidateReportsForOrg(organizationId);
  }

  private async releaseReservedForOrderTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    order: Order & { items: OrderItem[] },
  ): Promise<void> {
    const wh = await this.warehouseService.getOrCreateMainWarehouse(organizationId);
    for (const item of order.items) {
      const entry = await tx.stockEntry.findUnique({
        where: {
          organizationId_barcode_platform_warehouseId: {
            organizationId,
            barcode: item.barcode,
            platform: order.platform,
            warehouseId: wh.id,
          },
        },
      });
      if (!entry || entry.reservedQty <= 0) {
        continue;
      }
      const release = Math.min(entry.reservedQty, item.quantity);
      if (release <= 0) {
        continue;
      }
      await tx.stockEntry.update({
        where: { id: entry.id },
        data: { reservedQty: entry.reservedQty - release },
      });
    }
  }

  private serializeOrder(
    order: Order & { items: OrderItem[] } & { _count?: { items: number } },
    thumbnailByKey?: Map<string, string | null>,
  ): SerializedOrder {
    const { _count: _ignoredOrderItemCount, ...orderRest } = order;
    return {
      ...orderRest,
      totalAmount: order.totalAmount.toString(),
      cancellationRequestedAt:
        order.cancellationRequestedAt?.toISOString() ?? null,
      cancellationRequestNote: order.cancellationRequestNote ?? null,
      items: order.items.map((item) => {
        const thumbKey = `${order.platform}:${item.barcode}`;
        const base: SerializedOrderItem = {
          ...item,
          unitPrice: item.unitPrice.toString(),
        };
        if (thumbnailByKey?.has(thumbKey)) {
          base.thumbnailUrl = thumbnailByKey.get(thumbKey) ?? null;
        }
        return base;
      }),
    };
  }
}

function mapPlatformStatus(platformStatus: string): OrderStatus {
  const key = platformStatus.trim();
  const upper = key.toUpperCase();
  const map: Record<string, OrderStatus> = {
    Created: OrderStatus.NEW,
    Picking: OrderStatus.PICKING,
    Invoiced: OrderStatus.INVOICED,
    Shipped: OrderStatus.SHIPPED,
    Delivered: OrderStatus.DELIVERED,
    Cancelled: OrderStatus.CANCELLED,
    UnDelivered: OrderStatus.RETURNED,
  };
  const upperMap: Record<string, OrderStatus> = {
    CREATED: OrderStatus.NEW,
    PICKING: OrderStatus.PICKING,
    INVOICED: OrderStatus.INVOICED,
    SHIPPED: OrderStatus.SHIPPED,
    DELIVERED: OrderStatus.DELIVERED,
    CANCELLED: OrderStatus.CANCELLED,
    UNDELIVERED: OrderStatus.RETURNED,
  };
  return (
    map[key] ??
    upperMap[upper] ??
    (key.length > 0
      ? map[key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()]
      : undefined) ??
    OrderStatus.NEW
  );
}
