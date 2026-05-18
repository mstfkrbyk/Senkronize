import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlanTier, SubStatus, UserRole } from '@prisma/client';

import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const MS_PER_DAY = 86_400_000;

const SUGGESTED_TRIAL_FOLLOWUP_PLAN_LABEL: Record<PlanTier, string> = {
  BASLANGIC: 'Senkronize — Başlangıç Paketi',
  GELISIM: 'Senkronize — Gelişim Paketi',
  PRO: 'Senkronize — Pro Paket',
  KURUMSAL: 'Senkronize — Kurumsal Paket',
};

@Injectable()
export class TrialExpiryTask {
  private readonly logger = new Logger(TrialExpiryTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredTrials(): Promise<void> {
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.TRIAL,
        trialEndsAt: { lt: new Date() },
      },
    });

    for (const sub of expired) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubStatus.EXPIRED },
      });
      this.logger.log(`Deneme süresi doldu: org=${sub.organizationId}`);
    }
  }

  /** Deneme bitimine 3 gün kala günlük hatırlatma (tekrar gönderimi audit ile engeller). */
  @Cron('0 9 * * *')
  async notifyTrialsEndingSoon(): Promise<void> {
    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.TRIAL,
        trialEndsAt: { gt: new Date() },
      },
    });

    for (const sub of subs) {
      if (!sub.trialEndsAt) {
        continue;
      }
      const daysLeft = Math.ceil(
        (sub.trialEndsAt.getTime() - Date.now()) / MS_PER_DAY,
      );
      if (daysLeft !== 3) {
        continue;
      }

      const alreadySent = await this.prisma.auditLog.findFirst({
        where: {
          action: 'email.trial_expiring_3d',
          resourceType: 'Subscription',
          resourceId: sub.id,
        },
      });
      if (alreadySent) {
        continue;
      }

      const owner = await this.prisma.user.findFirst({
        where: {
          organizationId: sub.organizationId,
          role: UserRole.OWNER,
          deletedAt: null,
        },
      });
      if (!owner?.email) {
        continue;
      }

      try {
        const [ordersCount, syncJobsCount] = await Promise.all([
          this.prisma.order.count({
            where: {
              organizationId: sub.organizationId,
              deletedAt: null,
              createdAt: { gte: sub.createdAt },
            },
          }),
          this.prisma.listing.count({
            where: {
              organizationId: sub.organizationId,
              deletedAt: null,
              lastSyncAt: { gte: sub.createdAt },
            },
          }),
        ]);

        const suggestedLabel =
          SUGGESTED_TRIAL_FOLLOWUP_PLAN_LABEL[sub.plan];

        await this.emailService.sendTrialExpiring(owner.email, {
          name: owner.name ?? 'Merhaba',
          trialEndDate: sub.trialEndsAt.toLocaleDateString('tr-TR'),
          daysLeft: 3,
          lostFeatures: [
            'Çoklu pazaryeri ve kanal senkronizasyonu',
            'Otomatik stok ve fiyat güncellemeleri',
            'Sipariş, kargo ve ERP entegrasyonları',
          ],
          currentPlanLabel: 'Ücretsiz deneme',
          suggestedPlanLabel: suggestedLabel,
          subscribeUrl: `${this.panelBaseUrl()}/settings/subscription`,
          ordersCount,
          syncJobsCount,
        });
        await this.prisma.auditLog.create({
          data: {
            actorUserId: owner.id,
            actorOrgId: sub.organizationId,
            impersonatedOrgId: null,
            action: 'email.trial_expiring_3d',
            resourceType: 'Subscription',
            resourceId: sub.id,
            metadata: {},
          },
        });
      } catch (error: unknown) {
        this.logger.error('Deneme bitiş hatırlatma e-postası başarısız', {
          organizationId: sub.organizationId,
          error,
        });
      }
    }
  }
}
