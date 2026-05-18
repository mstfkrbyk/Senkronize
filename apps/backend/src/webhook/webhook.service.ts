import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, Prisma, type MarketplaceConnection } from '@prisma/client';
import type { Queue } from 'bull';

import { TRENDYOL_WEBHOOK_EVENTS } from '../adapters/trendyol/trendyol.constants';
import { EncryptionService } from '../common/encryption/encryption.service';
import { ListingService } from '../listing/listing.service';
import { OrderService } from '../order/order.service';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_MARKETPLACE_PULL,
  QUEUE_NOTIFICATION,
} from '../queue/queue.constants';
import type {
  MarketplacePullJobData,
  TrendyolWebhookJobData,
} from '../queue/queue.types';

import {
  extractHepsiburadaCargo,
  extractHepsiburadaEventType,
  extractHepsiburadaOrderStatus,
} from './hepsiburada-payload.util';
import { verifyHepsiburadaSignatureDigest } from './hepsiburada-signature.util';
import {
  extractOrderIdentifiers,
  extractProductIdentifiers,
  extractTrendyolEventType,
} from './trendyol-payload.util';
import { verifyTrendyolSignature } from './trendyol-signature.util';
import { resolvePlainWebhookSecret } from './webhook-secret.util';

function readTrimmedString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(v).trim();
  }
  return undefined;
}

function ciceksepetiSupplierKeyFromBody(
  rec: Record<string, unknown>,
): string | undefined {
  const direct =
    readTrimmedString(rec, 'supplierId') ??
    readTrimmedString(rec, 'sellerId') ??
    readTrimmedString(rec, 'supplierCode') ??
    readTrimmedString(rec, 'merchantId');
  if (direct) {
    return direct;
  }
  const nested = rec.data ?? rec.payload;
  if (typeof nested === 'object' && nested !== null && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    return (
      readTrimmedString(n, 'supplierId') ??
      readTrimmedString(n, 'sellerId') ??
      readTrimmedString(n, 'supplierCode') ??
      readTrimmedString(n, 'merchantId')
    );
  }
  return undefined;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly listingService: ListingService,
    private readonly encryptionService: EncryptionService,
    @InjectQueue(QUEUE_NOTIFICATION)
    private readonly notificationQueue: Queue<TrendyolWebhookJobData>,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly marketplacePullQueue: Queue<MarketplacePullJobData>,
  ) {}

  /**
   * Bağlantıyı doğrular, imzayı kontrol eder, WebhookEvent kaydeder ve kuyruğa ekler.
   */
  async acceptTrendyolWebhook(
    connectionId: string,
    signatureHeader: string | undefined,
    rawBody: Buffer,
  ): Promise<void> {
    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: connectionId,
        platform: Marketplace.TRENDYOL,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!connection) {
      throw new NotFoundException('Bağlantı bulunamadı');
    }
    const plainSecret = resolvePlainWebhookSecret(
      this.encryptionService,
      connection.webhookSecret,
    );
    if (!plainSecret) {
      throw new ForbiddenException('Webhook secret yapılandırılmamış');
    }
    if (!verifyTrendyolSignature(signatureHeader, rawBody, plainSecret)) {
      throw new ForbiddenException('Geçersiz imza');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Geçersiz JSON');
    }

    const eventType = extractTrendyolEventType(parsed);
    const normalizedType = eventType.trim().toUpperCase();
    const v2Types = TRENDYOL_WEBHOOK_EVENTS as readonly string[];
    if (normalizedType !== 'UNKNOWN' && !v2Types.includes(normalizedType)) {
      this.logger.warn('Trendyol webhook beklenmeyen event tipi', {
        eventType: normalizedType,
      });
    }

    const event = await this.prisma.webhookEvent.create({
      data: {
        organizationId: connection.organizationId,
        platform: Marketplace.TRENDYOL,
        eventType,
        payload: parsed as Prisma.InputJsonValue,
      },
    });

    await this.notificationQueue.add(
      'trendyol-webhook',
      { webhookEventId: event.id },
      STANDARD_QUEUE_JOB_OPTIONS,
    );
  }

  async processTrendyolWebhookJob(webhookEventId: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });
    if (!event || event.processed || event.platform !== Marketplace.TRENDYOL) {
      return;
    }

    try {
      await this.processTrendyolWebhook(
        event.organizationId,
        event.eventType,
        event.payload,
      );
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processed: true, processedAt: new Date(), error: null },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen webhook hatası';
      this.logger.error('Trendyol webhook işlenemedi', {
        webhookEventId,
        message,
      });
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { error: message },
      });
      throw error;
    }
  }

  async processTrendyolWebhook(
    organizationId: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    const normalized = eventType.trim().toUpperCase();

    if (
      normalized === 'ORDER_STATUS_CHANGED' ||
      normalized === 'PACKAGE_STATUS_CHANGED'
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

  /**
   * Bağlantı yoksa 404; imza veya secret uyumsuzsa false (403 controller'da).
   */
  async verifyHepsiburadaSignature(
    signature: string | undefined,
    rawBody: Buffer,
    connectionId: string,
  ): Promise<boolean> {
    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: connectionId,
        platform: Marketplace.HEPSIBURADA,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!connection) {
      throw new NotFoundException('Bağlantı bulunamadı');
    }
    const plainSecret = resolvePlainWebhookSecret(
      this.encryptionService,
      connection.webhookSecret,
    );
    if (!plainSecret) {
      return false;
    }
    return verifyHepsiburadaSignatureDigest(signature, rawBody, plainSecret);
  }

  async processHepsiburadaWebhook(
    connectionId: string,
    payload: unknown,
  ): Promise<void> {
    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: connectionId,
        platform: Marketplace.HEPSIBURADA,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!connection) {
      throw new NotFoundException('Bağlantı bulunamadı');
    }

    const eventType = extractHepsiburadaEventType(payload);

    const event = await this.prisma.webhookEvent.create({
      data: {
        organizationId: connection.organizationId,
        platform: Marketplace.HEPSIBURADA,
        eventType,
        payload: payload as Prisma.InputJsonValue,
      },
    });

    await this.notificationQueue.add(
      'hepsiburada-webhook',
      { webhookEventId: event.id },
      STANDARD_QUEUE_JOB_OPTIONS,
    );
  }

  async processHepsiburadaWebhookJob(webhookEventId: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });
    if (!event || event.processed || event.platform !== Marketplace.HEPSIBURADA) {
      return;
    }

    try {
      await this.processHepsiburadaWebhookPayload(
        event.organizationId,
        event.eventType,
        event.payload,
      );
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processed: true, processedAt: new Date(), error: null },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen webhook hatası';
      this.logger.error('Hepsiburada webhook işlenemedi', {
        webhookEventId,
        message,
      });
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { error: message },
      });
      throw error;
    }
  }

  private async processHepsiburadaWebhookPayload(
    organizationId: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    const normalized = eventType.trim().toUpperCase();

    if (normalized === 'ORDER_STATUS_UPDATE') {
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

    if (normalized === 'CARGO_TRACKING') {
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

  /**
   * Çiçeksepeti REST webhook: HMAC-SHA256 (x-signature) ile doğrulanır;
   * sipariş ve listeleme olaylarında pull kuyruğuna iş eklenir.
   */
  async processCiceksepeti(
    body: unknown,
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<void> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      this.logger.warn('Çiçeksepeti webhook beklenmeyen gövde');
      return;
    }
    const rec = body as Record<string, unknown>;
    const connection = await this.resolveCiceksepetiConnection(
      rec,
      rawBody,
      signature,
    );
    if (!connection) {
      return;
    }
    const plainSecret = this.resolveCiceksepetiWebhookSecret(connection);
    if (!plainSecret) {
      this.logger.warn('Çiçeksepeti webhook secret tanımlı değil', {
        connectionId: connection.id,
      });
      throw new ForbiddenException('Webhook secret yapılandırılmamış');
    }
    if (!verifyTrendyolSignature(signature, rawBody, plainSecret)) {
      throw new ForbiddenException('Geçersiz imza');
    }

    const eventRaw = rec.type ?? rec.event ?? rec.eventType;
    const event =
      typeof eventRaw === 'string' ? eventRaw.trim().toUpperCase() : '';

    if (event === 'ORDER_CREATED' || event === 'NEW_ORDER') {
      await this.marketplacePullQueue.add(
        'pull-orders',
        {
          organizationId: connection.organizationId,
          platform: Marketplace.CICEKSEPETI,
          type: 'orders',
        },
        JOB_DEFAULT_OPTIONS,
      );
      return;
    }

    if (
      event === 'PRODUCT_STATUS_CHANGED' ||
      event === 'PRODUCT_UPDATED' ||
      event === 'LISTING_UPDATED'
    ) {
      await this.marketplacePullQueue.add(
        'pull-listings',
        {
          organizationId: connection.organizationId,
          platform: Marketplace.CICEKSEPETI,
          type: 'listings',
        },
        JOB_DEFAULT_OPTIONS,
      );
    }
  }

  private decryptCredentialsJson(
    credentialsEnc: string,
  ): Record<string, unknown> {
    try {
      const json = this.encryptionService.decrypt(credentialsEnc);
      const parsed: unknown = JSON.parse(json);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return {};
      }
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private resolveCiceksepetiWebhookSecret(
    connection: MarketplaceConnection,
  ): string | null {
    const fromField = resolvePlainWebhookSecret(
      this.encryptionService,
      connection.webhookSecret,
    );
    if (fromField) {
      return fromField;
    }
    const creds = this.decryptCredentialsJson(connection.credentialsEnc);
    return (
      readTrimmedString(creds, 'secretKey') ??
      readTrimmedString(creds, 'webhookSecret') ??
      null
    );
  }

  private supplierMatchesCiceksepetiCredentials(
    creds: Record<string, unknown>,
    supplierKey: string,
  ): boolean {
    const keys = [
      'supplierId',
      'sellerId',
      'supplierCode',
      'merchantId',
      'storeId',
    ];
    for (const k of keys) {
      const v = readTrimmedString(creds, k);
      if (v && v === supplierKey) {
        return true;
      }
    }
    return false;
  }

  private async resolveCiceksepetiConnection(
    rec: Record<string, unknown>,
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<MarketplaceConnection | null> {
    const rows = await this.prisma.marketplaceConnection.findMany({
      where: {
        platform: Marketplace.CICEKSEPETI,
        deletedAt: null,
        isActive: true,
      },
    });
    if (rows.length === 0) {
      return null;
    }

    const supplierKey = ciceksepetiSupplierKeyFromBody(rec);
    let candidates = rows;
    if (supplierKey) {
      const matched = rows.filter((row) =>
        this.supplierMatchesCiceksepetiCredentials(
          this.decryptCredentialsJson(row.credentialsEnc),
          supplierKey,
        ),
      );
      if (matched.length === 1) {
        return matched[0];
      }
      if (matched.length > 1) {
        candidates = matched;
      }
    }

    for (const row of candidates) {
      const secret = this.resolveCiceksepetiWebhookSecret(row);
      if (secret && verifyTrendyolSignature(signature, rawBody, secret)) {
        return row;
      }
    }
    return null;
  }
}
