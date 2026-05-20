import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanTier, SubStatus, UserRole } from '@prisma/client';

import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboundWebhookService } from '../webhook/outbound-webhook.service';
import { WebhookEvent } from '../webhook/webhook-event.enum';

import { PLAN_LIMITS } from './plan-limits';

const MS_PER_DAY = 86_400_000;
const TRIAL_WARNING_DAYS = [7, 3, 1] as const;

const SUGGESTED_TRIAL_FOLLOWUP_PLAN_LABEL: Record<PlanTier, string> = {
  BASLANGIC: 'Senkronize — Başlangıç Paketi',
  GELISIM: 'Senkronize — Gelişim Paketi',
  PRO: 'Senkronize — Pro Paket',
  KURUMSAL: 'Senkronize — Kurumsal Paket',
};

@Injectable()
export class TrialService {
  private readonly logger = new Logger(TrialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly outboundWebhookService: OutboundWebhookService,
  ) {}

  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  private trialWarningAuditAction(daysLeft: number): string {
    return `email.trial_expiring_${daysLeft}d`;
  }

  async processExpiredTrials(): Promise<void> {
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

      void this.outboundWebhookService.dispatch(
        sub.organizationId,
        WebhookEvent.SUBSCRIPTION_EXPIRED,
        {
          organizationId: sub.organizationId,
          plan: sub.plan,
          trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
        },
      );

      this.logger.log(`Deneme süresi doldu: org=${sub.organizationId}`);
    }
  }

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

      if (!TRIAL_WARNING_DAYS.includes(daysLeft as (typeof TRIAL_WARNING_DAYS)[number])) {
        continue;
      }

      const auditAction = this.trialWarningAuditAction(daysLeft);
      const alreadySent = await this.prisma.auditLog.findFirst({
        where: {
          action: auditAction,
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

        await this.emailService.sendTrialExpiring(owner.email, {
          name: owner.name ?? 'Merhaba',
          trialEndDate: sub.trialEndsAt.toLocaleDateString('tr-TR'),
          daysLeft,
          lostFeatures: [
            'Çoklu pazaryeri ve kanal senkronizasyonu',
            'Otomatik stok ve fiyat güncellemeleri',
            'Sipariş, kargo ve ERP entegrasyonları',
          ],
          currentPlanLabel: 'Ücretsiz deneme',
          suggestedPlanLabel: SUGGESTED_TRIAL_FOLLOWUP_PLAN_LABEL[sub.plan],
          subscribeUrl: `${this.panelBaseUrl()}/settings/subscription`,
          ordersCount,
          syncJobsCount,
        });

        await this.prisma.auditLog.create({
          data: {
            actorUserId: owner.id,
            actorOrgId: sub.organizationId,
            impersonatedOrgId: null,
            action: auditAction,
            resourceType: 'Subscription',
            resourceId: sub.id,
            metadata: { daysLeft },
          },
        });
      } catch (error: unknown) {
        this.logger.error('Deneme bitiş hatırlatma e-postası başarısız', {
          organizationId: sub.organizationId,
          daysLeft,
          error,
        });
      }
    }
  }

  async extendTrial(
    organizationId: string,
    actorUserId: string,
    extraDays = 7,
  ): Promise<{ trialEndsAt: Date }> {
    if (extraDays < 1 || extraDays > 30) {
      throw new BadRequestException('Uzatma süresi 1–30 gün arasında olmalıdır.');
    }

    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    if (sub.status !== SubStatus.TRIAL && sub.status !== SubStatus.EXPIRED) {
      throw new BadRequestException(
        'Deneme uzatması yalnızca deneme veya süresi dolmuş deneme aboneliklerinde yapılabilir.',
      );
    }

    const base =
      sub.trialEndsAt && sub.trialEndsAt > new Date()
        ? sub.trialEndsAt
        : new Date();
    const trialEndsAt = new Date(base.getTime() + extraDays * MS_PER_DAY);

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { organizationId },
        data: {
          status: SubStatus.TRIAL,
          trialEndsAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          actorOrgId: organizationId,
          impersonatedOrgId: null,
          action: 'subscription.trial_extended',
          resourceType: 'Subscription',
          resourceId: sub.id,
          metadata: {
            extraDays,
            trialEndsAt: trialEndsAt.toISOString(),
            previousStatus: sub.status,
          },
        },
      });
    });

    this.logger.log(`Deneme uzatıldı: org=${organizationId}, +${extraDays} gün`);
    return { trialEndsAt };
  }

  /** Deneme süresinde etkin plan limitleri */
  trialEffectivePlan(): PlanTier {
    return PlanTier.BASLANGIC;
  }

  trialPlanLimits() {
    return PLAN_LIMITS[this.trialEffectivePlan()];
  }
}
