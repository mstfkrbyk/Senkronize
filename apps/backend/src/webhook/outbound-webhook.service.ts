import * as crypto from 'node:crypto';

import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryStatus,
  type Prisma,
  type WebhookDelivery,
  type WebhookEndpoint,
} from '@prisma/client';
import type { Job, Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_WEBHOOK_DELIVERY } from '../queue/queue.constants';
import type { WebhookDeliveryJobData } from '../queue/queue.types';

import type {
  CreateWebhookEndpointDto,
  UpdateWebhookEndpointDto,
} from './outbound-webhook.dto';
import {
  WEBHOOK_DELIVERY_JOB_OPTIONS,
  WEBHOOK_DELIVERY_TIMEOUT_MS,
} from './webhook-delivery.options';
import { WebhookEvent } from './webhook-event.enum';

const RESPONSE_BODY_MAX = 8000;

export interface WebhookEndpointListItem extends Omit<WebhookEndpoint, 'secret'> {
  lastDeliveryStatus: DeliveryStatus | null;
  lastDeliveryStatusCode: number | null;
  lastDeliveryAt: Date | null;
}

export interface WebhookDeliveryLogsPage {
  data: WebhookDelivery[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class OutboundWebhookService {
  private readonly logger = new Logger(OutboundWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_WEBHOOK_DELIVERY)
    private readonly webhookQueue: Queue<WebhookDeliveryJobData>,
  ) {}

  signPayload(secret: string, payload: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  async createEndpoint(
    orgId: string,
    dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    const secret =
      dto.secret && dto.secret.length >= 16
        ? dto.secret
        : `whsec_${crypto.randomBytes(32).toString('hex')}`;
    return this.prisma.webhookEndpoint.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        url: dto.url.trim(),
        secret,
        events: dto.events.map((e) => e.trim()),
        isActive: dto.isActive ?? true,
        retryCount: dto.retryCount ?? 5,
        timeoutMs: dto.timeoutMs ?? WEBHOOK_DELIVERY_TIMEOUT_MS,
      },
    });
  }

  async listEndpoints(orgId: string): Promise<WebhookEndpoint[]> {
    return this.prisma.webhookEndpoint.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listEndpointsWithSummary(orgId: string): Promise<WebhookEndpointListItem[]> {
    const rows = await this.listEndpoints(orgId);
    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((r) => r.id);
    const latestDeliveries = await this.prisma.webhookDelivery.findMany({
      where: { endpointId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      distinct: ['endpointId'],
    });
    const latestByEndpoint = new Map(
      latestDeliveries.map((d) => [d.endpointId, d]),
    );

    return rows.map((row) => {
      const { secret: _secret, ...rest } = row;
      const latest = latestByEndpoint.get(row.id);
      return {
        ...rest,
        lastDeliveryStatus: latest?.status ?? null,
        lastDeliveryStatusCode: latest?.statusCode ?? null,
        lastDeliveryAt: latest?.createdAt ?? null,
      };
    });
  }

  async updateEndpoint(
    orgId: string,
    id: string,
    dto: UpdateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    await this.requireEndpoint(orgId, id);
    const data: Prisma.WebhookEndpointUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.url !== undefined) {
      data.url = dto.url.trim();
    }
    if (dto.events !== undefined) {
      data.events = dto.events.map((e) => e.trim());
    }
    if (dto.secret !== undefined) {
      data.secret = dto.secret;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    if (dto.retryCount !== undefined) {
      data.retryCount = dto.retryCount;
    }
    if (dto.timeoutMs !== undefined) {
      data.timeoutMs = dto.timeoutMs;
    }
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data,
    });
  }

  async deleteEndpoint(orgId: string, id: string): Promise<void> {
    await this.requireEndpoint(orgId, id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  async testEndpoint(orgId: string, id: string): Promise<WebhookDelivery> {
    const endpoint = await this.requireEndpoint(orgId, id);
    const envelope = this.buildEnvelope(WebhookEvent.SYNC_COMPLETED, {
      test: true,
      message: 'Senkronize webhook test olayı',
    });
    const deliveryId = crypto.randomUUID().replace(/-/g, '').slice(0, 25);
    await this.prisma.webhookDelivery.create({
      data: {
        id: deliveryId,
        endpointId: endpoint.id,
        event: WebhookEvent.SYNC_COMPLETED,
        payload: envelope as Prisma.InputJsonValue,
        status: DeliveryStatus.PENDING,
        attempt: 1,
      },
    });
    return this.deliverOnce(endpoint, WebhookEvent.SYNC_COMPLETED, envelope, 1, deliveryId);
  }

  async dispatch(
    orgId: string,
    event: WebhookEvent | string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const endpoints = await this.getActiveEndpointsForEvent(orgId, event);
      for (const endpoint of endpoints) {
        const envelope = this.buildEnvelope(event, payload);
        const deliveryId = crypto.randomUUID().replace(/-/g, '').slice(0, 25);
        await this.prisma.webhookDelivery.create({
          data: {
            id: deliveryId,
            endpointId: endpoint.id,
            event,
            payload: envelope as Prisma.InputJsonValue,
            status: DeliveryStatus.PENDING,
            attempt: 1,
          },
        });
        await this.webhookQueue.add(
          'deliver',
          {
            endpointId: endpoint.id,
            deliveryId,
            event,
            payload: envelope,
          },
          {
            ...WEBHOOK_DELIVERY_JOB_OPTIONS,
            attempts: Math.max(1, endpoint.retryCount),
          },
        );
      }
    } catch (error) {
      this.logger.warn('Giden webhook kuyruğu eklenemedi', {
        organizationId: orgId,
        event,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  async getDeliveries(
    orgId: string,
    endpointId: string,
    page = 1,
    limit = 100,
  ): Promise<WebhookDeliveryLogsPage> {
    await this.requireEndpoint(orgId, endpointId);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.webhookDelivery.findMany({
        where: { endpointId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.webhookDelivery.count({ where: { endpointId } }),
    ]);

    return { data, total, page: safePage, limit: safeLimit };
  }

  async redeliver(
    orgId: string,
    endpointId: string,
    logId: string,
  ): Promise<WebhookDelivery> {
    const endpoint = await this.requireEndpoint(orgId, endpointId);
    const existing = await this.prisma.webhookDelivery.findFirst({
      where: { id: logId, endpointId: endpoint.id },
    });
    if (!existing) {
      throw new NotFoundException('Teslimat kaydı bulunamadı');
    }
    if (existing.status === DeliveryStatus.SUCCESS) {
      throw new BadRequestException('Başarılı teslimat tekrar gönderilemez');
    }

    const payload =
      typeof existing.payload === 'object' &&
      existing.payload !== null &&
      !Array.isArray(existing.payload)
        ? (existing.payload as Record<string, unknown>)
        : { data: existing.payload };

    await this.prisma.webhookDelivery.update({
      where: { id: existing.id },
      data: {
        status: DeliveryStatus.PENDING,
        statusCode: null,
        responseBody: null,
        duration: null,
        attempt: existing.attempt + 1,
      },
    });

    await this.webhookQueue.add(
      'deliver',
      {
        endpointId: endpoint.id,
        deliveryId: existing.id,
        event: existing.event,
        payload,
      },
      {
        ...WEBHOOK_DELIVERY_JOB_OPTIONS,
        attempts: Math.max(1, endpoint.retryCount),
      },
    );

    return this.prisma.webhookDelivery.findUniqueOrThrow({
      where: { id: existing.id },
    });
  }

  /**
   * Tek bir HTTP teslimatı — kuyruk işçisi ve test uç noktası tarafından kullanılır.
   * Ağ / HTTP hatalarında kayıt FAILED olur; kuyruk işçisi SUCCESS dışında throw eder.
   */
  async deliverOnce(
    endpointOrId: WebhookEndpoint | string,
    event: string,
    payload: Record<string, unknown>,
    attempt: number,
    deliveryId?: string,
  ): Promise<WebhookDelivery> {
    const endpoint =
      typeof endpointOrId === 'string'
        ? await this.prisma.webhookEndpoint.findUnique({
            where: { id: endpointOrId },
          })
        : endpointOrId;
    if (!endpoint) {
      throw new NotFoundException('Webhook uç noktası bulunamadı');
    }
    if (!endpoint.isActive) {
      if (deliveryId) {
        return this.prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: DeliveryStatus.FAILED,
            responseBody: 'Endpoint pasif',
            attempt,
          },
        });
      }
      return this.prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          event,
          payload: { skipped: true, reason: 'inactive' } as Prisma.InputJsonValue,
          status: DeliveryStatus.FAILED,
          attempt,
        },
      });
    }

    const bodyStr = JSON.stringify(payload);
    const signature = this.signPayload(endpoint.secret, bodyStr);
    const started = Date.now();
    const timeoutMs = endpoint.timeoutMs ?? WEBHOOK_DELIVERY_TIMEOUT_MS;

    const pending =
      deliveryId != null
        ? await this.prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DeliveryStatus.RETRYING,
              attempt,
              payload: payload as Prisma.InputJsonValue,
            },
          })
        : await this.prisma.webhookDelivery.create({
            data: {
              endpointId: endpoint.id,
              event,
              payload: payload as Prisma.InputJsonValue,
              status: DeliveryStatus.PENDING,
              attempt,
            },
          });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Senkronize-Signature': signature,
          'X-Senkronize-Event': event,
          'X-Senkronize-Delivery': pending.id,
          'User-Agent': 'Senkronize-Webhook/1.0',
        },
        body: bodyStr,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      const duration = Date.now() - started;
      const clipped = text.slice(0, RESPONSE_BODY_MAX);
      const ok = res.ok && res.status >= 200 && res.status < 300;
      return await this.prisma.webhookDelivery.update({
        where: { id: pending.id },
        data: {
          statusCode: res.status,
          responseBody: clipped.length > 0 ? clipped : null,
          duration,
          status: ok ? DeliveryStatus.SUCCESS : DeliveryStatus.FAILED,
        },
      });
    } catch (error) {
      const duration = Date.now() - started;
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen ağ hatası';
      return await this.prisma.webhookDelivery.update({
        where: { id: pending.id },
        data: {
          status: DeliveryStatus.FAILED,
          duration,
          responseBody: message.slice(0, RESPONSE_BODY_MAX),
        },
      });
    }
  }

  async handleDeliveryJob(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const attempt = job.attemptsMade + 1;
    const delivery = await this.deliverOnce(
      job.data.endpointId,
      job.data.event,
      job.data.payload,
      attempt,
      job.data.deliveryId,
    );
    if (delivery.status !== DeliveryStatus.SUCCESS) {
      throw new Error(
        delivery.statusCode != null
          ? `HTTP ${delivery.statusCode}`
          : 'Webhook teslimatı başarısız',
      );
    }
  }

  private buildEnvelope(
    event: string,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 25),
      event,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  private async getActiveEndpointsForEvent(
    orgId: string,
    event: string,
  ): Promise<WebhookEndpoint[]> {
    return this.prisma.webhookEndpoint.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        events: { has: event },
      },
    });
  }

  private async requireEndpoint(
    orgId: string,
    id: string,
  ): Promise<WebhookEndpoint> {
    const row = await this.prisma.webhookEndpoint.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!row) {
      throw new NotFoundException('Webhook uç noktası bulunamadı');
    }
    return row;
  }
}
