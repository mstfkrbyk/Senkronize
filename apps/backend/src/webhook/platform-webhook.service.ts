import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import type { Queue } from 'bull';

import { EncryptionService } from '../common/encryption/encryption.service';
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
  extractTrendyolEventType,
} from './trendyol-payload.util';
import { WebhookSignatureService } from './webhook-signature.service';
import { resolvePlainWebhookSecret } from './webhook-secret.util';

export type PlatformWebhookEvent =
  | 'order.created'
  | 'order.updated'
  | 'order.cancelled'
  | 'listing.updated'
  | 'stock.updated'
  | 'unknown';

function getHeader(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

function normalizeKey(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/[\s.-]+/g, '_')
    .replace(/__+/g, '_');
}

@Injectable()
export class PlatformWebhookService {
  private readonly logger = new Logger(PlatformWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly encryptionService: EncryptionService,
    private readonly webhookSignature: WebhookSignatureService,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly marketplacePullQueue: Queue<MarketplacePullJobData>,
  ) {}

  async handlePlatformWebhook(
    platform: Marketplace,
    orgId: string,
    headers: Record<string, string>,
    rawBody: Buffer,
  ): Promise<{ received: true }> {
    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: {
        organizationId: orgId,
        platform,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!connection) {
      throw new NotFoundException('Pazaryeri bağlantısı bulunamadı');
    }
    return this.handlePlatformWebhookForConnection(
      platform,
      connection.organizationId,
      connection,
      headers,
      rawBody,
    );
  }

  async handlePlatformWebhookByConnectionId(
    platform: Marketplace,
    connectionId: string,
    headers: Record<string, string>,
    rawBody: Buffer,
  ): Promise<{ received: true }> {
    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: connectionId.trim(),
        platform,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!connection) {
      throw new NotFoundException('Pazaryeri bağlantısı bulunamadı');
    }
    return this.handlePlatformWebhookForConnection(
      platform,
      connection.organizationId,
      connection,
      headers,
      rawBody,
    );
  }

  private async handlePlatformWebhookForConnection(
    platform: Marketplace,
    orgId: string,
    connection: { webhookSecret: string | null },
    headers: Record<string, string>,
    rawBody: Buffer,
  ): Promise<{ received: true }> {

    if (platform === Marketplace.AMAZON_TR) {
      const snsOk = await this.webhookSignature.verifyAmazon(rawBody, headers);
      if (!snsOk) {
        throw new ForbiddenException('Geçersiz SNS imzası');
      }
    } else if (platform === Marketplace.ETSY && this.isEtsyPing(rawBody)) {
      // Etsy kurulum ping'i — imza doğrulaması atlanır
    } else {
      const plainSecret = resolvePlainWebhookSecret(
        this.encryptionService,
        connection.webhookSecret,
      );
      if (!plainSecret) {
        throw new ForbiddenException('Webhook secret yapılandırılmamış');
      }
      const sigOk = this.verifySignature(platform, rawBody, headers, plainSecret);
      if (!sigOk) {
        throw new ForbiddenException('Geçersiz imza');
      }
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Geçersiz JSON');
    }

    const event = this.detectEvent(platform, parsedBody, headers);
    await this.dispatchEvent(orgId, platform, event, parsedBody);

    this.logger.log('Platform webhook işlendi', {
      organizationId: orgId,
      platform,
      event,
    });

    return { received: true };
  }

  private verifySignature(
    platform: Marketplace,
    rawBody: Buffer,
    headers: Record<string, string>,
    secret: string,
  ): boolean {
    switch (platform) {
      case Marketplace.TRENDYOL: {
        const sig =
          getHeader(headers, 'x-trendyol-signature') ??
          getHeader(headers, 'X-Trendyol-Signature') ??
          '';
        return this.webhookSignature.verifyTrendyol(rawBody, sig, secret);
      }
      case Marketplace.HEPSIBURADA: {
        const sig =
          getHeader(headers, 'x-hb-signature') ??
          getHeader(headers, 'X-HB-Signature') ??
          '';
        return this.webhookSignature.verifyHepsiburada(rawBody, sig, secret);
      }
      case Marketplace.N11: {
        const auth =
          getHeader(headers, 'authorization') ??
          getHeader(headers, 'Authorization') ??
          '';
        return this.webhookSignature.verifyN11(rawBody, auth, secret);
      }
      case Marketplace.ETSY: {
        const sig =
          getHeader(headers, 'x-etsy-signature') ??
          getHeader(headers, 'X-Etsy-Signature') ??
          '';
        return this.webhookSignature.verifyHmacSha256(rawBody, sig, secret, 'hex');
      }
      case Marketplace.SHOPIFY: {
        const sig =
          getHeader(headers, 'x-shopify-hmac-sha256') ??
          getHeader(headers, 'X-Shopify-Hmac-Sha256') ??
          '';
        return this.webhookSignature.verifyShopify(rawBody, sig, secret);
      }
      case Marketplace.WOOCOMMERCE: {
        const sig =
          getHeader(headers, 'x-wc-webhook-signature') ??
          getHeader(headers, 'X-WC-Webhook-Signature') ??
          '';
        return this.webhookSignature.verifyWooCommerce(rawBody, sig, secret);
      }
      default:
        return false;
    }
  }

  detectEvent(
    platform: Marketplace,
    body: unknown,
    headers: Record<string, string> = {},
  ): PlatformWebhookEvent {
    switch (platform) {
      case Marketplace.TRENDYOL:
        return this.detectTrendyolEvent(body);
      case Marketplace.HEPSIBURADA:
        return this.detectHepsiburadaEvent(body);
      case Marketplace.N11:
        return this.detectN11Event(body);
      case Marketplace.AMAZON_TR:
        return this.detectAmazonEvent(body);
      case Marketplace.ETSY:
        return this.detectEtsyEvent(body);
      case Marketplace.SHOPIFY:
        return this.detectShopifyEvent(headers);
      case Marketplace.WOOCOMMERCE:
        return this.detectWooCommerceEvent(body);
      default:
        return 'unknown';
    }
  }

  private detectShopifyEvent(headers: Record<string, string>): PlatformWebhookEvent {
    const topic = (getHeader(headers, 'x-shopify-topic') ?? '').toLowerCase();
    if (topic === 'orders/create') {
      return 'order.created';
    }
    if (topic === 'orders/updated' || topic === 'orders/edited') {
      return 'order.updated';
    }
    if (topic.includes('cancel')) {
      return 'order.cancelled';
    }
    if (topic.includes('inventory')) {
      return 'stock.updated';
    }
    if (topic.includes('products/')) {
      return 'listing.updated';
    }
    return 'unknown';
  }

  private detectWooCommerceEvent(body: unknown): PlatformWebhookEvent {
    if (typeof body !== 'object' || body === null) {
      return 'unknown';
    }
    const action = String(
      (body as Record<string, unknown>).action ?? '',
    ).toLowerCase();
    if (action === 'order.created' || action.includes('new_order')) {
      return 'order.created';
    }
    if (action === 'order.updated' || action.includes('order_status')) {
      return 'order.updated';
    }
    if (action.includes('cancel')) {
      return 'order.cancelled';
    }
    return 'unknown';
  }

  private detectTrendyolEvent(body: unknown): PlatformWebhookEvent {
    const raw = extractTrendyolEventType(body);
    const n = normalizeKey(raw);
    if (
      n === 'ORDER_CREATED' ||
      n === 'ORDERCREATED' ||
      n === 'NEW_ORDER'
    ) {
      return 'order.created';
    }
    if (n.includes('CANCEL')) {
      return 'order.cancelled';
    }
    if (
      n === 'ORDER_STATUS_CHANGED' ||
      n === 'ORDERSTATUSCHANGED' ||
      n === 'PACKAGE_STATUS_CHANGED' ||
      n === 'PACKAGESTATUSCHANGED'
    ) {
      return 'order.updated';
    }
    if (n.includes('STOCK')) {
      return 'stock.updated';
    }
    if (n.includes('PRODUCT')) {
      return 'listing.updated';
    }
    return 'unknown';
  }

  private detectHepsiburadaEvent(body: unknown): PlatformWebhookEvent {
    const raw = extractHepsiburadaEventType(body);
    const n = normalizeKey(raw);
    if (n === 'NEW_ORDER' || n === 'NEWORDER' || n === 'ORDER_CREATED') {
      return 'order.created';
    }
    if (n.includes('CANCEL')) {
      return 'order.cancelled';
    }
    if (
      n === 'ORDER_STATUS_UPDATE' ||
      n === 'ORDERSTATUSUPDATE' ||
      n === 'ORDER_LINE_ITEM_STATUS_CHANGED' ||
      n === 'CARGO_TRACKING' ||
      n === 'CARGOTRACKING' ||
      n.includes('SHIPPING')
    ) {
      return 'order.updated';
    }
    return 'unknown';
  }

  private detectN11Event(body: unknown): PlatformWebhookEvent {
    if (typeof body !== 'object' || body === null) {
      return 'unknown';
    }
    const rec = body as Record<string, unknown>;
    const raw =
      (typeof rec.eventType === 'string' && rec.eventType) ||
      (typeof rec.event === 'string' && rec.event) ||
      (typeof rec.type === 'string' && rec.type) ||
      'UNKNOWN';
    const n = normalizeKey(raw);
    if (n.includes('CANCEL')) {
      return 'order.cancelled';
    }
    if (
      n.includes('ORDER') &&
      (n.includes('NEW') || n.includes('CREATE'))
    ) {
      return 'order.created';
    }
    if (n.includes('ORDER') && n.includes('UPDATE')) {
      return 'order.updated';
    }
    if (n.includes('STOCK') || n.includes('INVENTORY')) {
      return 'stock.updated';
    }
    return 'unknown';
  }

  private detectAmazonEvent(body: unknown): PlatformWebhookEvent {
    if (typeof body !== 'object' || body === null) {
      return 'unknown';
    }
    const rec = body as Record<string, unknown>;
    if (rec.Type === 'SubscriptionConfirmation') {
      return 'unknown';
    }
    if (rec.Type === 'Notification') {
      const topic =
        typeof rec.Subject === 'string' ? rec.Subject.toLowerCase() : '';
      const msg =
        typeof rec.Message === 'string' ? rec.Message.toLowerCase() : '';
      if (topic.includes('cancel') || msg.includes('cancel')) {
        return 'order.cancelled';
      }
      if (topic.includes('order') || msg.includes('order')) {
        return 'order.created';
      }
    }
    return 'unknown';
  }

  private detectEtsyEvent(body: unknown): PlatformWebhookEvent {
    if (typeof body !== 'object' || body === null) {
      return 'unknown';
    }
    const rec = body as Record<string, unknown>;
    const action =
      (typeof rec.action === 'string' && rec.action) ||
      (typeof rec.event_type === 'string' && rec.event_type) ||
      '';
    const n = normalizeKey(action);
    if (n === 'PING' || n === 'CHALLENGE') {
      return 'unknown';
    }
    if (n.includes('RECEIPT') || n.includes('ORDER')) {
      if (n.includes('CREATE')) {
        return 'order.created';
      }
      if (n.includes('CANCEL')) {
        return 'order.cancelled';
      }
      return 'order.updated';
    }
    if (n.includes('LISTING') || n.includes('INVENTORY')) {
      return n.includes('STOCK') ? 'stock.updated' : 'listing.updated';
    }
    return 'unknown';
  }

  private isEtsyPing(rawBody: Buffer): boolean {
    try {
      const body = JSON.parse(rawBody.toString('utf8')) as unknown;
      if (typeof body !== 'object' || body === null) {
        return false;
      }
      const rec = body as Record<string, unknown>;
      const action =
        (typeof rec.action === 'string' && rec.action) ||
        (typeof rec.event_type === 'string' && rec.event_type) ||
        '';
      const n = normalizeKey(action);
      return n === 'PING' || n === 'CHALLENGE';
    } catch {
      return false;
    }
  }

  private async dispatchEvent(
    orgId: string,
    platform: Marketplace,
    event: PlatformWebhookEvent,
    payload: unknown,
  ): Promise<void> {
    if (platform === Marketplace.AMAZON_TR && typeof payload === 'object' && payload !== null) {
      const rec = payload as Record<string, unknown>;
      if (rec.Type === 'SubscriptionConfirmation' && typeof rec.SubscribeURL === 'string') {
        await fetch(rec.SubscribeURL, { method: 'GET' }).catch(() => undefined);
        return;
      }
    }

    switch (event) {
      case 'order.created':
      case 'order.updated':
      case 'order.cancelled':
        await this.marketplacePullQueue.add(
          'pull-orders',
          { organizationId: orgId, platform, type: 'orders' },
          JOB_DEFAULT_OPTIONS,
        );
        if (event === 'order.updated' || event === 'order.cancelled') {
          await this.tryInlineOrderStatusUpdate(orgId, platform, payload);
        }
        return;
      case 'stock.updated':
        await this.marketplacePullQueue.add(
          'pull-listings',
          { organizationId: orgId, platform, type: 'listings' },
          JOB_DEFAULT_OPTIONS,
        );
        return;
      case 'listing.updated':
        await this.marketplacePullQueue.add(
          'pull-listings',
          { organizationId: orgId, platform, type: 'listings' },
          JOB_DEFAULT_OPTIONS,
        );
        return;
      default:
        this.logger.debug('Platform webhook olay tipi atlandı', {
          organizationId: orgId,
          platform,
          event,
        });
    }
  }

  private async tryInlineOrderStatusUpdate(
    orgId: string,
    platform: Marketplace,
    payload: unknown,
  ): Promise<void> {
    if (platform === Marketplace.TRENDYOL) {
      const ids = extractOrderIdentifiers(payload);
      if (ids.platformOrderId && ids.status) {
        await this.orderService.updateStatusFromPlatform(
          orgId,
          platform,
          ids.platformOrderId,
          ids.status,
        );
      }
      return;
    }
    if (platform === Marketplace.HEPSIBURADA) {
      const ids = extractHepsiburadaOrderStatus(payload);
      if (ids.platformOrderId && ids.status) {
        await this.orderService.updateStatusFromPlatform(
          orgId,
          platform,
          ids.platformOrderId,
          ids.status,
        );
      }
      const cargo = extractHepsiburadaCargo(payload);
      if (cargo.platformOrderId) {
        await this.orderService.updateCargoFromPlatform(
          orgId,
          platform,
          cargo.platformOrderId,
          {
            trackingNumber: cargo.trackingNumber,
            cargoProvider: cargo.cargoCompany,
          },
        );
      }
    }
  }
}
