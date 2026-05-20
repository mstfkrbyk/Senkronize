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

    if (platform === Marketplace.AMAZON_TR) {
      const snsOk = await this.webhookSignature.verifyAmazon(rawBody, headers);
      if (!snsOk) {
        throw new ForbiddenException('Geçersiz SNS imzası');
      }
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

    const event = this.detectEvent(platform, parsedBody);
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
      default:
        return false;
    }
  }

  detectEvent(platform: Marketplace, body: unknown): PlatformWebhookEvent {
    switch (platform) {
      case Marketplace.TRENDYOL:
        return this.detectTrendyolEvent(body);
      case Marketplace.HEPSIBURADA:
        return this.detectHepsiburadaEvent(body);
      case Marketplace.N11:
        return this.detectN11Event(body);
      case Marketplace.AMAZON_TR:
        return this.detectAmazonEvent(body);
      default:
        return 'unknown';
    }
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
      n === 'ORDER_LINE_ITEM_STATUS_CHANGED'
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
    }
  }
}
