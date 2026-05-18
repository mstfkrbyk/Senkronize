import * as crypto from 'node:crypto';

import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DeliveryStatus,
  type Prisma,
  type WebhookDelivery,
  type WebhookEndpoint,
} from '@prisma/client';
import type { Job } from 'bull';
import type { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_WEBHOOK_DELIVERY,
} from '../queue/queue.constants';
import type { WebhookDeliveryJobData } from '../queue/queue.types';

import type {
  CreateWebhookEndpointDto,
  UpdateWebhookEndpointDto,
} from './outbound-webhook.dto';

const RESPONSE_BODY_MAX = 8000;

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
        retryCount: dto.retryCount ?? 3,
        timeoutMs: dto.timeoutMs ?? 5000,
      },
    });
  }

  async listEndpoints(orgId: string): Promise<WebhookEndpoint[]> {
    return this.prisma.webhookEndpoint.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
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
    const payload = {
      event: 'test' as const,
      timestamp: new Date().toISOString(),
    };
    return this.deliverOnce(endpoint, 'test', payload, 1);
  }

  async dispatch(
    orgId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const endpoints = await this.getActiveEndpointsForEvent(orgId, event);
      for (const endpoint of endpoints) {
        await this.webhookQueue.add(
          'deliver',
          { endpointId: endpoint.id, event, payload },
          {
            ...JOB_DEFAULT_OPTIONS,
            attempts: Math.max(1, endpoint.retryCount),
            backoff: { type: 'exponential', delay: 2000 },
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
  ): Promise<WebhookDelivery[]> {
    await this.requireEndpoint(orgId, endpointId);
    return this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
      return this.prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          event,
          payload: { skipped: true, reason: 'inactive' } as object,
          status: DeliveryStatus.FAILED,
          attempt,
        },
      });
    }

    const bodyObj: Record<string, unknown> = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };
    const bodyStr = JSON.stringify(bodyObj);
    const signature = this.signPayload(endpoint.secret, bodyStr);
    const started = Date.now();

    const pending = await this.prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event,
        payload: bodyObj as Prisma.InputJsonValue,
        status: DeliveryStatus.PENDING,
        attempt,
      },
    });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), endpoint.timeoutMs);
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Senkronize-Signature': signature,
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
    );
    if (delivery.status !== DeliveryStatus.SUCCESS) {
      throw new Error('Webhook teslimatı başarısız');
    }
  }

  async markFinalFailureFromJob(job: Job<WebhookDeliveryJobData>): Promise<void> {
    try {
      const latest = await this.prisma.webhookDelivery.findFirst({
        where: {
          endpointId: job.data.endpointId,
          event: job.data.event,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (
        latest &&
        latest.status !== DeliveryStatus.SUCCESS &&
        latest.status !== DeliveryStatus.FAILED
      ) {
        await this.prisma.webhookDelivery.update({
          where: { id: latest.id },
          data: { status: DeliveryStatus.FAILED },
        });
      }
    } catch (error) {
      this.logger.warn('Webhook teslimatı son hata güncellenemedi', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
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
