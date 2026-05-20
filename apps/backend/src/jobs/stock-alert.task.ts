import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NotificationType, UserRole } from '@prisma/client';

import { DashboardGateway } from '../dashboard/dashboard.gateway';
import { EmailService } from '../notifications/email/email.service';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockAlertTask {
  private readonly logger = new Logger(StockAlertTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly config: ConfigService,
    private readonly dashboardGateway: DashboardGateway,
  ) {}

  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  @Cron('0 8 * * *')
  async checkLowStock(): Promise<void> {
    this.logger.log('Düşük stok kontrolü başlıyor...');

    const orgRows = await this.prisma.listing.findMany({
      where: {
        deletedAt: null,
        quantity: { lte: 5, gt: 0 },
      },
      distinct: ['organizationId'],
      select: { organizationId: true },
    });

    for (const { organizationId } of orgRows) {
      const org = await this.prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
      });
      if (!org) {
        continue;
      }

      const owner = await this.prisma.user.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          role: UserRole.OWNER,
        },
      });
      const admin =
        owner ??
        (await this.prisma.user.findFirst({
          where: {
            organizationId,
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
      if (pref != null && (!pref.emailEnabled || !pref.stockAlert)) {
        continue;
      }

      const lowProducts = await this.prisma.listing.findMany({
        where: {
          organizationId,
          deletedAt: null,
          quantity: { lte: 5, gt: 0 },
        },
        select: { title: true, quantity: true, barcode: true },
        take: 10,
        orderBy: { quantity: 'asc' },
      });

      const totalLow = await this.prisma.listing.count({
        where: {
          organizationId,
          deletedAt: null,
          quantity: { lte: 5, gt: 0 },
        },
      });

      await this.emailService.sendLowStockAlert(admin.email, {
        recipientName: admin.name ?? 'Merhaba',
        count: totalLow,
        products: lowProducts.map((p) => ({
          name: p.title,
          sku: p.barcode,
          currentStock: p.quantity,
          threshold: 5,
        })),
        stockUpdateUrl: `${this.panelBaseUrl()}/stock`,
      });

      try {
        await this.inAppNotificationService.create({
          organizationId,
          type: NotificationType.STOCK_LOW,
          title: 'Düşük stok uyarısı',
          message: `${String(totalLow)} ürün kritik stok seviyesinin altında (≤5).`,
          link: '/stock',
          metadata: { sampleTitles: lowProducts.map((p) => p.title) },
        });
      } catch (notifyErr) {
        this.logger.warn('In-app stok bildirimi oluşturulamadı', {
          organizationId,
          message:
            notifyErr instanceof Error ? notifyErr.message : 'unknown',
        });
      }

      const sample = lowProducts[0];
      if (sample) {
        this.dashboardGateway.emitStockAlert(organizationId, {
          barcode: sample.barcode,
          title: sample.title,
          quantity: sample.quantity,
          threshold: 5,
        });
      }

      this.logger.log(`${org.name}: ${String(totalLow)} düşük stok uyarısı e-postası gönderildi`);
    }
  }

  @Cron('0 9 * * 1')
  async checkOutOfStock(): Promise<void> {
    this.logger.log('Sıfır stok haftalık özeti başlıyor...');

    const orgRows = await this.prisma.listing.findMany({
      where: { deletedAt: null, quantity: 0 },
      distinct: ['organizationId'],
      select: { organizationId: true },
    });

    for (const { organizationId } of orgRows) {
      const org = await this.prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
      });
      if (!org) {
        continue;
      }

      const owner = await this.prisma.user.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          role: UserRole.OWNER,
        },
      });
      const admin =
        owner ??
        (await this.prisma.user.findFirst({
          where: {
            organizationId,
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
      if (pref != null && (!pref.emailEnabled || !pref.stockAlert)) {
        continue;
      }

      const totalZero = await this.prisma.listing.count({
        where: { organizationId, deletedAt: null, quantity: 0 },
      });
      if (totalZero === 0) {
        continue;
      }

      const samples = await this.prisma.listing.findMany({
        where: { organizationId, deletedAt: null, quantity: 0 },
        select: { title: true },
        take: 15,
        orderBy: { updatedAt: 'desc' },
      });

      await this.emailService.sendOutOfStockWeeklyReport(
        admin.email,
        admin.name ?? 'Merhaba',
        totalZero,
        samples.map((s) => s.title),
      );

      this.logger.log(`${org.name}: sıfır stok haftalık özeti gönderildi (${String(totalZero)} kayıt)`);
    }
  }
}
