import { Injectable, Logger } from '@nestjs/common';
import { Marketplace, type Order } from '@prisma/client';
import type { MarketplaceOrder } from '@senkronize/shared';

import { AdapterRegistry } from '../adapters/adapter.registry';
import {
  toMarketplaceOrder,
  type NormalizedOrder,
} from '../adapters/common/order-normalizer';
import { CustomerService } from '../customer/customer.service';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { ECOMMERCE_MARKETPLACE_PLATFORMS } from '../marketplace-connection/ecommerce-platforms';
import { MarketplaceConnectionService } from '../marketplace-connection/marketplace-connection.service';
import { PrismaService } from '../prisma/prisma.service';

import { OrderService } from './order.service';

type OrderByIdAdapter = {
  getOrderById(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<NormalizedOrder | null>;
};

function hasGetOrderById(adapter: unknown): adapter is OrderByIdAdapter {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    typeof (adapter as OrderByIdAdapter).getOrderById === 'function'
  );
}

@Injectable()
export class OrderPullService {
  private readonly logger = new Logger(OrderPullService.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly marketplaceConnectionService: MarketplaceConnectionService,
    private readonly orderService: OrderService,
    private readonly prisma: PrismaService,
    private readonly customerService: CustomerService,
    private readonly eventService: EventService,
  ) {}

  private resolveAdapter(platform: Marketplace) {
    const key = String(platform);
    if (
      ECOMMERCE_MARKETPLACE_PLATFORMS.includes(key) &&
      this.adapterRegistry.hasEcommerceAdapter(key)
    ) {
      return this.adapterRegistry.getEcommerce(key);
    }
    return this.adapterRegistry.get(key);
  }

  async pullOrders(
    organizationId: string,
    platform: Marketplace,
    since?: Date,
  ): Promise<{ createdOrders: Order[]; total: number }> {
    const credentials =
      await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
        organizationId,
        platform,
      );
    if (!credentials) {
      this.logger.warn('Aktif bağlantı bulunamadı', { organizationId, platform });
      return { createdOrders: [], total: 0 };
    }

    const adapter = this.resolveAdapter(platform);
    const orders = await adapter.getOrders(credentials, since);
    return this.persistOrders(organizationId, platform, orders);
  }

  async pullOrderByExternalId(
    organizationId: string,
    platform: Marketplace,
    externalId: string,
  ): Promise<Order | null> {
    const credentials =
      await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
        organizationId,
        platform,
      );
    if (!credentials) {
      return null;
    }

    const adapter = this.resolveAdapter(platform);
    if (!hasGetOrderById(adapter)) {
      return null;
    }
    const normalized = await adapter.getOrderById(credentials, externalId);
    if (!normalized) {
      return null;
    }

    const { createdOrders } = await this.persistOrders(organizationId, platform, [
      toMarketplaceOrder(normalized),
    ]);
    return createdOrders[0] ?? null;
  }

  async persistOrders(
    organizationId: string,
    platform: Marketplace,
    orders: MarketplaceOrder[],
  ): Promise<{ createdOrders: Order[]; total: number }> {
    if (orders.length === 0) {
      return { createdOrders: [], total: 0 };
    }

    const platformOrderIds = [...new Set(orders.map((o) => o.platformOrderId))];
    const existing = await this.prisma.order.findMany({
      where: {
        organizationId,
        platform,
        platformOrderId: { in: platformOrderIds },
        deletedAt: null,
      },
      select: { platformOrderId: true },
    });
    const existingSet = new Set(existing.map((r) => r.platformOrderId));

    const { createdOrders } = await this.orderService.upsertFromPlatform(
      organizationId,
      platform,
      orders,
    );

    for (const order of createdOrders) {
      if (!existingSet.has(order.platformOrderId)) {
        try {
          await this.customerService.upsertFromOrder(order);
        } catch (customerErr) {
          this.logger.warn('Müşteri kaydı güncellenemedi', {
            organizationId,
            orderId: order.id,
            message:
              customerErr instanceof Error ? customerErr.message : 'unknown',
          });
        }
        this.eventService.emit(organizationId, WS_EVENTS.ORDER_NEW, {
          orderId: order.id,
          platform,
          buyerName: order.customerName,
          totalAmount: order.totalAmount.toString(),
          createdAt: order.createdAt.toISOString(),
        });
      }
    }

    return { createdOrders, total: orders.length };
  }
}
