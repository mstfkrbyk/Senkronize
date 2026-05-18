import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  PlanTier,
  SubStatus,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EncryptionService } from '../common/encryption/encryption.service';
import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaytrService } from './paytr.service';
import type { PaytrWebhookPayload } from './paytr.types';

const PLAN_PRICES_KURUS: Record<PlanTier, number> = {
  BASLANGIC: 49_900,
  GELISIM: 99_900,
  PRO: 199_900,
  KURUMSAL: 499_900,
};

const PLAN_LABEL_TR: Record<PlanTier, string> = {
  BASLANGIC: 'Senkronize — Başlangıç Paketi',
  GELISIM: 'Senkronize — Gelişim Paketi',
  PRO: 'Senkronize — Pro Paket',
  KURUMSAL: 'Senkronize — Kurumsal Paket',
};

/** Paket yenilemesinde uygulanan limit varsayılanları */
const PLAN_LIMITS: Record<
  PlanTier,
  {
    monthlyOrderLimit: number;
    marketplaceLimit: number;
    ecommerceLimit: number;
    erpLimit: number;
    userLimit: number;
  }
> = {
  BASLANGIC: {
    monthlyOrderLimit: 500,
    marketplaceLimit: 1,
    ecommerceLimit: 1,
    erpLimit: 1,
    userLimit: 2,
  },
  GELISIM: {
    monthlyOrderLimit: 2_000,
    marketplaceLimit: 3,
    ecommerceLimit: 2,
    erpLimit: 2,
    userLimit: 5,
  },
  PRO: {
    monthlyOrderLimit: 10_000,
    marketplaceLimit: 10,
    ecommerceLimit: 5,
    erpLimit: 3,
    userLimit: 15,
  },
  KURUMSAL: {
    monthlyOrderLimit: 100_000,
    marketplaceLimit: 50,
    ecommerceLimit: 20,
    erpLimit: 10,
    userLimit: 100,
  },
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paytrService: PaytrService,
    private readonly encryptionService: EncryptionService,
    private readonly emailService: EmailService,
  ) {}

  async getSubscription(organizationId: string): Promise<unknown> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    return sub;
  }

  async createCheckoutToken(
    organizationId: string,
    actor: AuthenticatedUser,
    plan: PlanTier,
    userIp: string,
  ): Promise<{ iframeToken: string; merchantOid: string }> {
    const amount = PLAN_PRICES_KURUS[plan];
    const merchantOid = this.paytrService.generateOrderId();

    await this.prisma.payment.create({
      data: {
        organizationId,
        amount,
        currency: 'TRY',
        status: PaymentStatus.PENDING,
        paytrOrderId: merchantOid,
        plan,
      },
    });

    try {
      return await this.paytrService.requestIframeToken({
        userIp,
        merchantOid,
        email: actor.email,
        paymentAmountKurus: amount,
        userName: actor.name,
        userAddress: 'Türkiye',
        userPhone: actor.phone?.trim() || '05000000000',
        planLabel: PLAN_LABEL_TR[plan],
      });
    } catch {
      await this.prisma.payment.updateMany({
        where: { paytrOrderId: merchantOid, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.FAILED,
          failReason: 'paytr_get_token_failed',
        },
      });
      throw new BadRequestException(
        'Ödeme oturumu başlatılamadı. Lütfen daha sonra tekrar deneyin.',
      );
    }
  }

  async cancelSubscription(
    organizationId: string,
    actorUserId: string,
  ): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    if (sub.status === SubStatus.CANCELLED) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { organizationId },
        data: { status: SubStatus.CANCELLED },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          actorOrgId: organizationId,
          impersonatedOrgId: null,
          action: 'subscription.cancel_requested',
          resourceType: 'Subscription',
          resourceId: sub.id,
          metadata: {
            previousStatus: sub.status,
            effectiveUntil: sub.currentPeriodEnd.toISOString(),
          },
        },
      });
    });
  }

  async getPaymentHistory(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where: { organizationId } }),
    ]);
    return { items, total, page, limit };
  }

  async handleWebhook(payload: PaytrWebhookPayload): Promise<void> {
    const oid = payload.merchant_oid?.trim();
    if (!oid) {
      throw new BadRequestException('merchant_oid eksik');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { paytrOrderId: oid },
    });
    if (!payment) {
      this.logger.warn('Webhook: merchant_oid için ödeme kaydı yok');
      return;
    }

    if (payment.status === PaymentStatus.SUCCESS && payload.status === 'success') {
      return;
    }
    if (payment.status === PaymentStatus.FAILED && payload.status === 'failed') {
      return;
    }

    const failCode =
      payload.failed_reason_code ?? payload.fail_reason_code ?? '';
    const failMsg =
      payload.failed_reason_msg ?? payload.fail_reason_msg ?? '';

    if (payload.status === 'success') {
      const totalKurus = parseInt(payload.total_amount, 10);
      if (Number.isNaN(totalKurus)) {
        this.logger.warn('Webhook: total_amount sayısal değil');
        return;
      }
      const periodStart = new Date();
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const nextBilling = new Date(periodEnd);
      const limits = PLAN_LIMITS[payment.plan];

      const cardTokenPlain = payload.ctoken?.trim();
      const encryptedCardToken = cardTokenPlain
        ? this.encryptionService.encrypt(cardTokenPlain)
        : null;

      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCESS,
            amount: totalKurus,
            periodStart,
            periodEnd,
          },
        });

        const sub = await tx.subscription.update({
          where: { organizationId: payment.organizationId },
          data: {
            plan: payment.plan,
            status: SubStatus.ACTIVE,
            trialEndsAt: null,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            nextBillingAt: nextBilling,
            paytrSubscriptionId: payload.recurring_id ?? undefined,
            monthlyOrderLimit: limits.monthlyOrderLimit,
            marketplaceLimit: limits.marketplaceLimit,
            ecommerceLimit: limits.ecommerceLimit,
            erpLimit: limits.erpLimit,
            userLimit: limits.userLimit,
          },
        });

        await tx.paytrSubscription.upsert({
          where: { organizationId: payment.organizationId },
          create: {
            organizationId: payment.organizationId,
            paytrSubsId: payload.recurring_id ?? null,
            paytrCustomerId: payload.utoken ?? null,
            cardToken: encryptedCardToken,
          },
          update: {
            paytrSubsId: payload.recurring_id ?? undefined,
            paytrCustomerId: payload.utoken ?? undefined,
            ...(encryptedCardToken ? { cardToken: encryptedCardToken } : {}),
          },
        });

        const owner = await tx.user.findFirst({
          where: {
            organizationId: payment.organizationId,
            role: UserRole.OWNER,
            deletedAt: null,
          },
        });
        const fallbackActor = await tx.user.findFirst({
          where: { organizationId: payment.organizationId, deletedAt: null },
        });
        const actorUserId = owner?.id ?? fallbackActor?.id;
        if (!actorUserId) {
          this.logger.error(
            'Abonelik güncellemesi: OWNER kullanıcı bulunamadı, audit atlandı',
          );
        } else {
          await tx.auditLog.create({
            data: {
              actorUserId,
              actorOrgId: payment.organizationId,
              impersonatedOrgId: null,
              action: 'subscription.plan_activated',
              resourceType: 'Subscription',
              resourceId: sub.id,
              metadata: {
                plan: payment.plan,
                paymentId: payment.id,
                totalKurus,
              },
            },
          });
        }
      });

      const ownerForEmail = await this.prisma.user.findFirst({
        where: {
          organizationId: payment.organizationId,
          role: UserRole.OWNER,
          deletedAt: null,
        },
      });
      if (ownerForEmail?.email) {
        void this.emailService
          .sendSubscriptionConfirm(
            ownerForEmail.email,
            ownerForEmail.name ?? 'Merhaba',
            PLAN_LABEL_TR[payment.plan],
            nextBilling,
          )
          .catch((error: unknown) => {
            this.logger.error('Abonelik onay e-postası gönderilemedi', {
              organizationId: payment.organizationId,
              error,
            });
          });
      }
      return;
    }

    if (payload.status === 'failed') {
      const reason = [failCode, failMsg].filter(Boolean).join(' — ') || 'failed';
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failReason: reason.slice(0, 500),
          },
        });
        const owner = await tx.user.findFirst({
          where: {
            organizationId: payment.organizationId,
            role: UserRole.OWNER,
            deletedAt: null,
          },
        });
        const fallbackActor = await tx.user.findFirst({
          where: { organizationId: payment.organizationId, deletedAt: null },
        });
        const actorUserId = owner?.id ?? fallbackActor?.id;
        if (actorUserId) {
          await tx.auditLog.create({
            data: {
              actorUserId,
              actorOrgId: payment.organizationId,
              impersonatedOrgId: null,
              action: 'subscription.payment_failed',
              resourceType: 'Payment',
              resourceId: payment.id,
              metadata: { paytrOrderId: oid },
            },
          });
        }
      });
      return;
    }

    this.logger.warn('Webhook: desteklenmeyen status değeri');
    return;
  }
}
