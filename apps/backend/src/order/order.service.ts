import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Marketplace,
  OrderStatus,
  Prisma,
  type Order,
  type OrderItem,
} from '@prisma/client';
import type { MarketplaceOrder } from '@senkronize/shared';

import { PrismaService } from '../prisma/prisma.service';

import type { OrderQueryDto, OrderSummaryDto } from './order.dto';

export type SerializedOrderItem = Omit<OrderItem, 'unitPrice'> & {
  unitPrice: string;
};

export type SerializedOrder = Omit<Order, 'totalAmount'> & {
  totalAmount: string;
  items: SerializedOrderItem[];
};

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

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

    const where: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.platform && { platform: query.platform }),
      ...(query.status && { status: query.status }),
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

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { platformCreatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: rows.map((o) => this.serializeOrder(o)),
      total,
    };
  }

  async findOne(organizationId: string, id: string): Promise<SerializedOrder> {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }
    return this.serializeOrder(order);
  }

  async upsertFromPlatform(
    organizationId: string,
    platform: Marketplace,
    orders: MarketplaceOrder[],
  ): Promise<void> {
    for (const o of orders) {
      await this.prisma.order.upsert({
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
      });
    }
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

  private serializeOrder(
    order: Order & { items: OrderItem[] },
  ): SerializedOrder {
    return {
      ...order,
      totalAmount: order.totalAmount.toString(),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toString(),
      })),
    };
  }
}

function mapPlatformStatus(platformStatus: string): OrderStatus {
  const map: Record<string, OrderStatus> = {
    Created: OrderStatus.NEW,
    Picking: OrderStatus.PICKING,
    Invoiced: OrderStatus.INVOICED,
    Shipped: OrderStatus.SHIPPED,
    Delivered: OrderStatus.DELIVERED,
    Cancelled: OrderStatus.CANCELLED,
    UnDelivered: OrderStatus.RETURNED,
  };
  return map[platformStatus] ?? OrderStatus.NEW;
}
