import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, Prisma } from '@prisma/client';
import type { Queue } from 'bull';

import { ListingService } from '../listing/listing.service';
import { OrderService } from '../order/order.service';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_NOTIFICATION } from '../queue/queue.constants';
import type { TrendyolWebhookJobData } from '../queue/queue.types';

import {
  extractOrderIdentifiers,
  extractProductIdentifiers,
  extractTrendyolEventType,
} from './trendyol-payload.util';
import { verifyTrendyolSignature } from './trendyol-signature.util';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly listingService: ListingService,
    @InjectQueue(QUEUE_NOTIFICATION)
    private readonly notificationQueue: Queue<TrendyolWebhookJobData>,
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
    if (!connection.webhookSecret) {
      throw new ForbiddenException('Webhook secret yapılandırılmamış');
    }
    if (
      !verifyTrendyolSignature(
        signatureHeader,
        rawBody,
        connection.webhookSecret,
      )
    ) {
      throw new ForbiddenException('Geçersiz imza');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Geçersiz JSON');
    }

    const eventType = extractTrendyolEventType(parsed);

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
    if (!event || event.processed) {
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

    if (normalized === 'ORDER_STATUS_CHANGED') {
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
    }
  }
}
