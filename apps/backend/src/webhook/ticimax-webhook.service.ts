import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace } from '@prisma/client';

import { AdapterRegistry } from '../adapters/adapter.registry';
import {
  toMarketplaceOrder,
  type NormalizedOrder,
} from '../adapters/common/order-normalizer';
import { EncryptionService } from '../common/encryption/encryption.service';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { OrderPullService } from '../order/order-pull.service';
import { OrderService } from '../order/order.service';
import { PrismaService } from '../prisma/prisma.service';

import { WebhookSignatureService } from './webhook-signature.service';

interface TicimaxWebhookBody {
  type?: string;
  orderId?: string | number;
  orderNo?: string | number;
  status?: string | number;
}

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

@Injectable()
export class TicimaxWebhookService {
  private readonly logger = new Logger(TicimaxWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly webhookSignature: WebhookSignatureService,
    private readonly orderService: OrderService,
    private readonly orderPullService: OrderPullService,
    private readonly adapterRegistry: AdapterRegistry,
    private readonly eventService: EventService,
  ) {}

  async handleWebhook(
    connectionId: string,
    headers: Record<string, string>,
    rawBody: Buffer,
  ): Promise<{ received: true }> {
    const connection = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: connectionId.trim(),
        platform: Marketplace.TICIMAX,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!connection) {
      throw new NotFoundException('Ticimax bağlantısı bulunamadı');
    }

    const credentials = this.parseCredentials(connection.credentialsEnc);
    const apiKey = credentials?.apiKey?.trim();
    if (!apiKey) {
      throw new ForbiddenException('Ticimax API anahtarı yapılandırılmamış');
    }

    const signature =
      getHeader(headers, 'x-ticimax-signature') ??
      getHeader(headers, 'X-Ticimax-Signature') ??
      '';
    if (!this.webhookSignature.verifyTicimax(rawBody, signature, apiKey)) {
      throw new ForbiddenException('Geçersiz imza');
    }

    let body: TicimaxWebhookBody;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as TicimaxWebhookBody;
    } catch {
      throw new BadRequestException('Geçersiz JSON');
    }

    const orderId = body.orderId != null ? String(body.orderId) : '';
    const orderNo = body.orderNo != null ? String(body.orderNo) : '';
    const platformOrderIds = [orderId, orderNo].filter((id) => id.length > 0);
    if (platformOrderIds.length === 0) {
      throw new BadRequestException('orderId veya orderNo zorunlu');
    }

    const orgId = connection.organizationId;
    const platform = Marketplace.TICIMAX;
    const statusRaw = body.status != null ? String(body.status) : '';

    let existing = await this.prisma.order.findFirst({
      where: {
        organizationId: orgId,
        platform,
        platformOrderId: { in: platformOrderIds },
        deletedAt: null,
      },
      select: { id: true, status: true, platformOrderId: true },
    });

    if (!existing && credentials) {
      const fetchId = orderId || orderNo;
      const adapter = this.adapterRegistry.getEcommerce('TICIMAX') as {
        getOrderById?(
          creds: Record<string, string>,
          id: string,
        ): Promise<NormalizedOrder | null>;
      };
      if (typeof adapter.getOrderById === 'function') {
        const normalized = await adapter.getOrderById(credentials, fetchId);
        if (normalized) {
          const marketplaceOrder = toMarketplaceOrder(normalized);
          if (statusRaw) {
            marketplaceOrder.status = statusRaw;
          }
          await this.orderPullService.persistOrders(orgId, platform, [
            marketplaceOrder,
          ]);
        }
      }
      existing = await this.prisma.order.findFirst({
        where: {
          organizationId: orgId,
          platform,
          platformOrderId: { in: platformOrderIds },
          deletedAt: null,
        },
        select: { id: true, status: true, platformOrderId: true },
      });
    }

    if (!existing) {
      this.logger.warn('Ticimax webhook: sipariş bulunamadı', {
        organizationId: orgId,
        orderId,
        orderNo,
      });
      return { received: true };
    }

    if (!statusRaw) {
      return { received: true };
    }

    const prevStatus = existing.status;
    await this.orderService.updateStatusFromPlatform(
      orgId,
      platform,
      existing.platformOrderId,
      statusRaw,
    );

    const after = await this.prisma.order.findFirst({
      where: { id: existing.id, organizationId: orgId, deletedAt: null },
      select: { id: true, status: true, cargoTrackingNumber: true },
    });

    if (after && prevStatus !== after.status) {
      this.eventService.emit(orgId, WS_EVENTS.ORDER_UPDATED, {
        orderId: after.id,
        platformOrderId: existing.platformOrderId,
        oldStatus: prevStatus,
        newStatus: after.status,
        shipmentTrackingNumber: after.cargoTrackingNumber ?? null,
      });
    }

    this.logger.log('Ticimax webhook işlendi', {
      organizationId: orgId,
      event: body.type,
      platformOrderId: existing.platformOrderId,
    });

    return { received: true };
  }

  private parseCredentials(
    credentialsEnc: string,
  ): Record<string, string> | null {
    try {
      const json = this.encryptionService.decrypt(credentialsEnc);
      const parsed: unknown = JSON.parse(json);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return null;
      }
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') {
          out[k] = v;
        }
      }
      return out;
    } catch {
      return null;
    }
  }
}
