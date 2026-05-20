import { randomBytes } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NotificationType, POStatus, Prisma, UserRole } from '@prisma/client';

import { EmailService } from '../notifications/email/email.service';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { PrismaService } from '../prisma/prisma.service';

import { StockForecastService } from './stock-forecast.service';

@Injectable()
export class StockForecastTask {
  private readonly logger = new Logger(StockForecastTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockForecastService: StockForecastService,
    private readonly emailService: EmailService,
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly config: ConfigService,
  ) {}

  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  @Cron('0 2 * * *')
  async runCriticalStockForecast(): Promise<void> {
    this.logger.log('Kritik stok tahmini (satış hızı) başlıyor...');

    const orgRows = await this.prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });

    for (const org of orgRows) {
      const critical = await this.stockForecastService.getCriticalStockItems(
        org.id,
        7,
      );
      if (critical.length === 0) {
        continue;
      }

      const owner = await this.prisma.user.findFirst({
        where: {
          organizationId: org.id,
          deletedAt: null,
          role: UserRole.OWNER,
        },
      });
      const admin =
        owner ??
        (await this.prisma.user.findFirst({
          where: {
            organizationId: org.id,
            deletedAt: null,
            role: UserRole.ADMIN,
          },
        }));
      if (!admin) {
        continue;
      }

      const pref = await this.prisma.notificationPreference.findUnique({
        where: { userId: admin.id },
      });
      const emailAllowed =
        pref == null ||
        (pref.emailEnabled && (pref.emailLowStock || pref.stockAlert));

      const samples = critical.slice(0, 12);
      const forecastUrl = `${this.panelBaseUrl()}/stock/forecast`;

      if (emailAllowed) {
        await this.emailService.sendCriticalStockForecastAlert(admin.email, {
          recipientName: admin.name ?? 'Merhaba',
          count: critical.length,
          products: samples.map((c) => ({
            name: c.name,
            barcode: c.barcode,
            daysLeft:
              c.daysUntilStockout === null ? '—' : String(c.daysUntilStockout),
            recommendedQty: String(c.recommendedOrderQty),
          })),
          forecastUrl,
        });
      }

      try {
        await this.inAppNotificationService.create({
          organizationId: org.id,
          type: NotificationType.STOCK_LOW,
          title: 'Kritik stok tahmini',
          message: `${String(critical.length)} ürünün stoku satış hızına göre 7 gün içinde tükenebilir.`,
          link: '/stock/forecast',
          metadata: {
            kind: 'stock_forecast_critical',
            sampleBarcodes: samples.map((s) => s.barcode),
          },
        });
      } catch (notifyErr) {
        this.logger.warn('In-app kritik stok bildirimi oluşturulamadı', {
          organizationId: org.id,
          message:
            notifyErr instanceof Error ? notifyErr.message : 'unknown',
        });
      }

      await this.maybeCreateDraftPurchaseOrders(org.id, critical);

      this.logger.log(
        `${org.name}: kritik stok tahmini işlendi (${String(critical.length)} ürün)`,
      );
    }
  }

  private async maybeCreateDraftPurchaseOrders(
    organizationId: string,
    critical: Awaited<
      ReturnType<StockForecastService['getCriticalStockItems']>
    >,
  ): Promise<void> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { organizationId, deletedAt: null, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!supplier) {
      return;
    }

    const since = new Date(Date.now() - 36 * 60 * 60 * 1000);

    for (const row of critical.slice(0, 25)) {
      if (row.recommendedOrderQty <= 0) {
        continue;
      }

      const exists = await this.prisma.purchaseOrder.findFirst({
        where: {
          organizationId,
          status: POStatus.DRAFT,
          createdAt: { gte: since },
          items: { some: { barcode: row.barcode } },
        },
        select: { id: true },
      });
      if (exists) {
        continue;
      }

      const unitCostRaw =
        row.unitCostTry !== null && row.unitCostTry > 0
          ? row.unitCostTry
          : 0.01;
      const unitCost = new Prisma.Decimal(unitCostRaw);
      const qty = row.recommendedOrderQty;
      const totalLine = unitCost.mul(qty);
      const orderNumber = `TAHM-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString('hex')}`;

      try {
        await this.prisma.$transaction(async (tx) => {
          const po = await tx.purchaseOrder.create({
            data: {
              organizationId,
              supplierId: supplier.id,
              orderNumber,
              status: POStatus.DRAFT,
              totalAmount: totalLine,
              currency: 'TRY',
              notes: 'STOCK_FORECAST_AUTO',
            },
          });
          await tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: po.id,
              barcode: row.barcode,
              productName: row.name,
              quantity: qty,
              orderedQty: qty,
              unitCost,
              totalCost: totalLine,
            },
          });
        });
        this.logger.log(
          `Otomatik PO taslağı: org=${organizationId} barkod=${row.barcode} miktar=${String(qty)}`,
        );
      } catch (err) {
        this.logger.warn('Otomatik PO taslağı oluşturulamadı', {
          organizationId,
          barcode: row.barcode,
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
  }
}
