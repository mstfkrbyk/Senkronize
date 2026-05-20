import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Marketplace, Prisma } from '@prisma/client';
import type { Queue } from 'bull';

import { ListingService } from '../listing/listing.service';
import { OrderService } from '../order/order.service';
import { PrismaService } from '../prisma/prisma.service';
import { JOB_DEFAULT_OPTIONS, QUEUE_MARKETPLACE_PULL } from '../queue/queue.constants';
import type { MarketplacePullJobData } from '../queue/queue.types';

import {
  extractHepsiburadaCargo,
  extractHepsiburadaEventType,
  extractHepsiburadaOrderStatus,
} from './hepsiburada-payload.util';
import {
  extractOrderIdentifiers,
  extractProductIdentifiers,
  extractTrendyolEventType,
} from './trendyol-payload.util';

function normalizeEventKey(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/__+/g, '_');
}

@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly listingService: ListingService,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly marketplacePullQueue: Queue<MarketplacePullJobData>,
  ) {}

  async processWebhookLogById(webhookLogId: string): Promise<void> {
    const log = await this.prisma.webhookLog.findUnique({
      where: { id: webhookLogId },
    });
    if (!log) {
      return;
    }
    if (log.status === 'processed' || log.status === 'skipped') {
      return;
    }
    if (!log.organizationId) {
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'failed',
          errorMessage: 'Organizasyon eşleşmedi',
          processedAt: new Date(),
        },
      });
      return;
    }

    const orgId = log.organizationId;
    const slug = log.platform.toLowerCase();

    try {
      switch (slug) {
        case 'trendyol':
          await this.processTrendyol(log.payload, orgId);
          break;
        case 'hepsiburada':
          await this.processHepsiburada(log.payload, orgId);
          break;
        case 'n11':
          await this.processN11(log.payload, orgId);
          break;
        case 'amazon':
        case 'amazon_tr':
          await this.processAmazon(log.payload, orgId);
          break;
        case 'shopify':
          await this.processShopify(log.payload, orgId, log.eventType);
          break;
        case 'woocommerce':
          await this.processWooCommerce(log.payload, orgId, log.eventType);
          break;
        default:
          this.logger.warn('WebhookLog bilinmeyen platform', { platform: slug });
          await this.prisma.webhookLog.update({
            where: { id: webhookLogId },
            data: {
              status: 'skipped',
              processedAt: new Date(),
              errorMessage: null,
            },
          });
          return;
      }
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'processed',
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen webhook hatası';
      this.logger.error('WebhookLog işlenemedi', { webhookLogId, message });
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'failed',
          errorMessage: message,
          processedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async processTrendyol(payload: unknown, organizationId: string): Promise<void> {
    const eventType = extractTrendyolEventType(payload);
    const normalized = normalizeEventKey(eventType);

    if (
      normalized === 'ORDER_CREATED' ||
      normalized === 'ORDERCREATED' ||
      normalized === 'NEW_ORDER'
    ) {
      await this.marketplacePullQueue.add(
        'pull-orders',
        {
          organizationId,
          platform: Marketplace.TRENDYOL,
          type: 'orders',
        },
        JOB_DEFAULT_OPTIONS,
      );
      return;
    }

    if (
      normalized === 'ORDER_STATUS_CHANGED' ||
      normalized === 'ORDERSTATUSCHANGED' ||
      normalized === 'PACKAGE_STATUS_CHANGED' ||
      normalized === 'PACKAGESTATUSCHANGED'
    ) {
      const ids = extractOrderIdentifiers(payload);
      if (ids.platformOrderId && ids.status) {
        await this.orderService.updateStatusFromPlatform(
          organizationId,
          Marketplace.TRENDYOL,
          ids.platformOrderId,
          ids.status,
        );
      }
      return;
    }

    if (
      normalized === 'PRODUCT_STOCK_UPDATED' ||
      normalized === 'PRODUCTSTOCKUPDATED' ||
      normalized === 'STOCK_UPDATED'
    ) {
      await this.marketplacePullQueue.add(
        'pull-stock',
        {
          organizationId,
          platform: Marketplace.TRENDYOL,
          type: 'stock',
        },
        JOB_DEFAULT_OPTIONS,
      );
      return;
    }

    if (normalized === 'PRODUCT_APPROVED') {
      const product = extractProductIdentifiers(payload);
      await this.listingService.updateApprovalStatusFromWebhook(
        organizationId,
        Marketplace.TRENDYOL,
        {
          approved: true,
          platformProductId: product.platformProductId,
          barcode: product.barcode,
        },
      );
      return;
    }

    if (normalized === 'PRODUCT_REJECTED') {
      const product = extractProductIdentifiers(payload);
      await this.listingService.updateApprovalStatusFromWebhook(
        organizationId,
        Marketplace.TRENDYOL,
        {
          approved: false,
          platformProductId: product.platformProductId,
          barcode: product.barcode,
        },
      );
    }
  }

  async processHepsiburada(
    payload: unknown,
    organizationId: string,
  ): Promise<void> {
    const eventType = extractHepsiburadaEventType(payload);
    const normalized = normalizeEventKey(eventType);

    if (
      normalized === 'NEW_ORDER' ||
      normalized === 'NEWORDER' ||
      normalized === 'ORDER_CREATED'
    ) {
      await this.marketplacePullQueue.add(
        'pull-orders',
        {
          organizationId,
          platform: Marketplace.HEPSIBURADA,
          type: 'orders',
        },
        JOB_DEFAULT_OPTIONS,
      );
      return;
    }

    if (
      normalized === 'ORDER_LINE_ITEM_STATUS_CHANGED' ||
      normalized === 'ORDERLINESTATUSCHANGED' ||
      normalized === 'ORDER_STATUS_UPDATE' ||
      normalized === 'ORDERSTATUSUPDATE'
    ) {
      const ids = extractHepsiburadaOrderStatus(payload);
      if (ids.platformOrderId && ids.status) {
        await this.orderService.updateStatusFromPlatform(
          organizationId,
          Marketplace.HEPSIBURADA,
          ids.platformOrderId,
          ids.status,
        );
      }
      return;
    }

    if (normalized === 'CARGO_TRACKING' || normalized === 'CARGOTRACKING') {
      const cargo = extractHepsiburadaCargo(payload);
      if (!cargo.platformOrderId) {
        return;
      }
      const data: Prisma.OrderUpdateManyMutationInput = {
        syncedAt: new Date(),
      };
      if (cargo.trackingNumber !== undefined) {
        data.cargoTrackingNumber = cargo.trackingNumber;
      }
      if (cargo.cargoCompany !== undefined) {
        data.cargoProvider = cargo.cargoCompany;
      }
      await this.prisma.order.updateMany({
        where: {
          organizationId,
          platform: Marketplace.HEPSIBURADA,
          platformOrderId: cargo.platformOrderId,
          deletedAt: null,
        },
        data,
      });
    }
  }

  async processN11(payload: unknown, organizationId: string): Promise<void> {
    const event = this.readStringField(payload, [
      'eventType',
      'event',
      'type',
      'EventType',
    ]);
    const normalized = normalizeEventKey(event ?? 'UNKNOWN');

    if (
      normalized.includes('ORDER') &&
      (normalized.includes('NEW') || normalized.includes('CREATE'))
    ) {
      await this.marketplacePullQueue.add(
        'pull-orders',
        {
          organizationId,
          platform: Marketplace.N11,
          type: 'orders',
        },
        JOB_DEFAULT_OPTIONS,
      );
      return;
    }

    if (normalized.includes('STOCK') || normalized.includes('INVENTORY')) {
      await this.marketplacePullQueue.add(
        'pull-stock',
        {
          organizationId,
          platform: Marketplace.N11,
          type: 'stock',
        },
        JOB_DEFAULT_OPTIONS,
      );
    }
  }

  async processAmazon(payload: unknown, organizationId: string): Promise<void> {
    if (typeof payload !== 'object' || payload === null) {
      return;
    }
    const rec = payload as Record<string, unknown>;
    const type = typeof rec.Type === 'string' ? rec.Type : '';

    if (type === 'SubscriptionConfirmation' && typeof rec.SubscribeURL === 'string') {
      await fetch(rec.SubscribeURL, { method: 'GET' }).catch(() => undefined);
      return;
    }

    if (type === 'Notification' && typeof rec.Message === 'string') {
      let inner: unknown;
      try {
        inner = JSON.parse(rec.Message) as unknown;
      } catch {
        inner = rec.Message;
      }
      const topic =
        typeof rec.Subject === 'string' ? rec.Subject.toLowerCase() : '';
      const msgStr =
        typeof inner === 'string' ? inner.toLowerCase() : JSON.stringify(inner).toLowerCase();
      if (
        topic.includes('order') ||
        msgStr.includes('order') ||
        msgStr.includes('purchase')
      ) {
        await this.marketplacePullQueue.add(
          'pull-orders',
          {
            organizationId,
            platform: Marketplace.AMAZON_TR,
            type: 'orders',
          },
          JOB_DEFAULT_OPTIONS,
        );
      }
    }
  }

  async processShopify(
    payload: unknown,
    organizationId: string,
    eventTypeHint?: string,
  ): Promise<void> {
    const topic =
      eventTypeHint?.trim() ||
      this.readStringField(payload, ['topic', 'X-Shopify-Topic']);
    const normalized = normalizeEventKey(topic ?? 'UNKNOWN');

    if (normalized.includes('ORDERS_CREATE') || normalized === 'ORDERS/CREATE') {
      await this.marketplacePullQueue.add(
        'pull-orders',
        {
          organizationId,
          platform: Marketplace.SHOPIFY,
          type: 'orders',
        },
        JOB_DEFAULT_OPTIONS,
      );
      return;
    }

    if (normalized.includes('ORDERS_UPDATED') || normalized === 'ORDERS/UPDATED') {
      await this.marketplacePullQueue.add(
        'pull-orders',
        {
          organizationId,
          platform: Marketplace.SHOPIFY,
          type: 'orders',
        },
        JOB_DEFAULT_OPTIONS,
      );
      return;
    }

    if (
      normalized.includes('INVENTORY_LEVELS') ||
      normalized.includes('INVENTORY')
    ) {
      await this.marketplacePullQueue.add(
        'pull-stock',
        {
          organizationId,
          platform: Marketplace.SHOPIFY,
          type: 'stock',
        },
        JOB_DEFAULT_OPTIONS,
      );
    }
  }

  async processWooCommerce(
    payload: unknown,
    organizationId: string,
    eventTypeHint?: string,
  ): Promise<void> {
    const action =
      eventTypeHint?.trim() ||
      this.readStringField(payload, ['action', 'hook', 'event']);
    const normalized = normalizeEventKey(action ?? 'UNKNOWN');

    if (
      normalized === 'WOOCOMMERCE_NEW_ORDER' ||
      normalized === 'NEW_ORDER' ||
      normalized.includes('NEW_ORDER')
    ) {
      await this.marketplacePullQueue.add(
        'pull-orders',
        {
          organizationId,
          platform: Marketplace.WOOCOMMERCE,
          type: 'orders',
        },
        JOB_DEFAULT_OPTIONS,
      );
      return;
    }

    if (
      normalized === 'ORDER_UPDATED' ||
      normalized === 'ORDER.UPDATED' ||
      normalized.includes('ORDER_UPDATED') ||
      normalized === 'WOOCOMMERCE_ORDER_STATUS_CHANGED' ||
      normalized.includes('ORDER_STATUS')
    ) {
      await this.marketplacePullQueue.add(
        'pull-orders',
        {
          organizationId,
          platform: Marketplace.WOOCOMMERCE,
          type: 'orders',
        },
        JOB_DEFAULT_OPTIONS,
      );
    }
  }

  private readStringField(
    payload: unknown,
    keys: string[],
  ): string | undefined {
    if (typeof payload !== 'object' || payload === null) {
      return undefined;
    }
    const rec = payload as Record<string, unknown>;
    for (const k of keys) {
      const v = rec[k];
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
    return undefined;
  }
}
