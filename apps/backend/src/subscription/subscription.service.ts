import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingPeriod,
  NotificationType,
  PaymentStatus,
  PlanTier,
  SubStatus,
  UserRole,
  type Subscription,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EncryptionService } from '../common/encryption/encryption.service';
import { EmailService } from '../notifications/email/email.service';
import type { InvoiceEmailData } from '../notifications/email/email-template.types';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { PartnerService } from '../partner/partner.service';
import { CacheKeys } from '../common/cache/cache-keys';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { IyzicoService } from '../payment/iyzico.service';
import {
  normalizeIyzicoEventType,
  type IyzicoWebhookPayload,
} from '../payment/iyzico.types';
import { PaytrService } from './paytr.service';
import type { PaytrWebhookPayload } from './paytr.types';
import type {
  CheckoutUrlResult,
  PlanUpgradeRequestResult,
  UsageStats,
} from './subscription.types';

const PLAN_PRICES_KURUS: Record<PlanTier, number> = {
  BASLANGIC: 290_000,
  GELISIM: 590_000,
  PRO: 990_000,
  KURUMSAL: 1_990_000,
};

const PLAN_LABEL_TR: Record<PlanTier, string> = {
  BASLANGIC: 'Senkronize — Başlangıç Paketi',
  GELISIM: 'Senkronize — Gelişim Paketi',
  PRO: 'Senkronize — Pro Paket',
  KURUMSAL: 'Senkronize — Kurumsal Paket',
};

const PLAN_TIER_RANK: Record<PlanTier, number> = {
  BASLANGIC: 0,
  GELISIM: 1,
  PRO: 2,
  KURUMSAL: 3,
};

function formatTryAmount(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount);
}

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

/** Panel kullanım metrikleri — -1 sınırsız */
const USAGE_PLAN_LIMITS: Record<
  PlanTier,
  {
    connections: number;
    products: number;
    ordersPerMonth: number;
    apiKeys: number;
  }
> = {
  BASLANGIC: {
    connections: 5,
    products: 1_000,
    ordersPerMonth: 500,
    apiKeys: 2,
  },
  GELISIM: {
    connections: 10,
    products: 5_000,
    ordersPerMonth: 2_000,
    apiKeys: 5,
  },
  PRO: {
    connections: 20,
    products: 10_000,
    ordersPerMonth: 5_000,
    apiKeys: 10,
  },
  KURUMSAL: {
    connections: -1,
    products: -1,
    ordersPerMonth: -1,
    apiKeys: -1,
  },
};

function planLimitFeatureLines(plan: PlanTier): string[] {
  const L = PLAN_LIMITS[plan];
  return [
    `Aylık sipariş limiti: ${L.monthlyOrderLimit.toLocaleString('tr-TR')}`,
    `Pazaryeri bağlantısı: ${L.marketplaceLimit}`,
    `E-ticaret bağlantısı: ${L.ecommerceLimit}`,
    `ERP bağlantısı: ${L.erpLimit}`,
    `Kullanıcı kotası: ${L.userLimit}`,
  ];
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly paytrService: PaytrService,
    private readonly iyzicoService: IyzicoService,
    private readonly encryptionService: EncryptionService,
    private readonly emailService: EmailService,
    private readonly partnerService: PartnerService,
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly config: ConfigService,
  ) {}

  /** Panel taban URL (e-posta bağlantıları) */
  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  /** DB'de limit null ise paket varsayılanı */
  effectiveMarketplaceLimit(subscription: Subscription): number {
    return (
      subscription.marketplaceLimit ??
      PLAN_LIMITS[subscription.plan].marketplaceLimit
    );
  }

  private async invalidateSubscriptionCache(
    organizationId: string,
  ): Promise<void> {
    await this.cache.del(CacheKeys.subscription(organizationId));
  }

  async getSubscription(organizationId: string): Promise<Subscription> {
    return this.cache.readThrough(
      CacheKeys.subscription(organizationId),
      1_800,
      async () => {
        const sub = await this.prisma.subscription.findUnique({
          where: { organizationId },
        });
        if (!sub) {
          throw new NotFoundException('Abonelik bulunamadı.');
        }
        return sub;
      },
    );
  }

  async changePlan(
    organizationId: string,
    actorUserId: string,
    newPlan: PlanTier,
  ): Promise<Subscription> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    if (sub.status !== SubStatus.ACTIVE && sub.status !== SubStatus.TRIAL) {
      throw new BadRequestException(
        'Plan değişikliği yalnızca aktif veya deneme aboneliklerinde yapılabilir.',
      );
    }
    if (sub.plan === newPlan) {
      throw new BadRequestException('Zaten bu plandasınız.');
    }

    const previousPlan = sub.plan;
    const limits = PLAN_LIMITS[newPlan];

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.subscription.update({
        where: { organizationId },
        data: {
          plan: newPlan,
          monthlyOrderLimit: limits.monthlyOrderLimit,
          marketplaceLimit: limits.marketplaceLimit,
          ecommerceLimit: limits.ecommerceLimit,
          erpLimit: limits.erpLimit,
          userLimit: limits.userLimit,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          actorOrgId: organizationId,
          impersonatedOrgId: null,
          action: 'subscription.plan_changed',
          resourceType: 'Subscription',
          resourceId: next.id,
          metadata: {
            previousPlan,
            newPlan,
          },
        },
      });
      return next;
    });

    try {
      await this.inAppNotificationService.create({
        organizationId,
        type: NotificationType.SYSTEM,
        title: 'Paket güncellendi',
        message: `Abonelik planınız ${PLAN_LABEL_TR[newPlan]} olarak güncellendi.`,
        link: '/settings/subscription',
        metadata: { previousPlan, newPlan },
      });
    } catch (notifyErr) {
      this.logger.warn('Plan değişikliği in-app bildirimi oluşturulamadı', {
        organizationId,
        message: notifyErr instanceof Error ? notifyErr.message : 'unknown',
      });
    }

    const owner = await this.prisma.user.findFirst({
      where: {
        organizationId,
        role: UserRole.OWNER,
        deletedAt: null,
      },
    });
    if (owner?.email) {
      const isUpgrade =
        PLAN_TIER_RANK[newPlan] > PLAN_TIER_RANK[previousPlan];
      const newFeatures = isUpgrade
        ? planLimitFeatureLines(newPlan)
        : [];
      void this.emailService
        .sendSubscriptionPlanChanged(owner.email, {
          name: owner.name ?? 'Merhaba',
          previousPlanLabel: PLAN_LABEL_TR[previousPlan],
          newPlanLabel: PLAN_LABEL_TR[newPlan],
          effectiveDate: new Date().toLocaleDateString('tr-TR'),
          newFeatures,
          exploreUrl: `${this.panelBaseUrl()}/settings/subscription`,
          isUpgrade,
        })
        .catch((error: unknown) => {
          this.logger.error('Plan değişikliği e-postası gönderilemedi', {
            organizationId,
            error,
          });
        });
    }

    await this.invalidateSubscriptionCache(organizationId);
    return updated;
  }

  async cancelSubscription(
    organizationId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    if (
      sub.status === SubStatus.CANCELLED ||
      sub.status === SubStatus.CANCELING
    ) {
      return;
    }

    const trimmedReason = reason?.trim().slice(0, 500) ?? null;
    const canceledAt = new Date();
    const subscriptionEndsAt = sub.currentPeriodEnd;

    const iyzicoSub = await this.prisma.iyzicoSubscription.findUnique({
      where: { organizationId },
    });
    if (iyzicoSub?.subscriptionRefCode) {
      try {
        await this.iyzicoService.cancelSubscription(
          iyzicoSub.subscriptionRefCode,
        );
      } catch (err) {
        this.logger.warn('Iyzico abonelik iptali API hatası', {
          organizationId,
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { organizationId },
        data: {
          status: SubStatus.CANCELING,
          subscriptionEndsAt,
          canceledAt,
          cancelReason: trimmedReason,
        },
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
            hasReason: Boolean(trimmedReason),
          },
        },
      });
    });

    try {
      await this.inAppNotificationService.create({
        organizationId,
        type: NotificationType.SYSTEM,
        title: 'Abonelik iptal talebi',
        message: `Aboneliğiniz ${subscriptionEndsAt.toLocaleDateString('tr-TR')} tarihine kadar kullanılabilir.`,
        link: '/settings/subscription',
        metadata: { effectiveUntil: sub.currentPeriodEnd.toISOString() },
      });
    } catch (notifyErr) {
      this.logger.warn('İptal in-app bildirimi oluşturulamadı', {
        organizationId,
        message: notifyErr instanceof Error ? notifyErr.message : 'unknown',
      });
    }

    const owner = await this.prisma.user.findFirst({
      where: {
        organizationId,
        role: UserRole.OWNER,
        deletedAt: null,
      },
    });
    if (owner?.email) {
      void this.emailService
        .sendSubscriptionCancelled(
          owner.email,
          owner.name ?? 'Merhaba',
          sub.currentPeriodEnd,
        )
        .catch((error: unknown) => {
          this.logger.error('İptal bilgilendirme e-postası gönderilemedi', {
            organizationId,
            error,
          });
        });
    }

    await this.invalidateSubscriptionCache(organizationId);
  }

  async reactivateSubscription(
    organizationId: string,
    actorUserId: string,
  ): Promise<Subscription> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    if (sub.status !== SubStatus.CANCELLED) {
      throw new BadRequestException(
        'Yeniden aktivasyon yalnızca iptal edilmiş abonelikler için geçerlidir.',
      );
    }

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    const limits = PLAN_LIMITS[sub.plan];

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.subscription.update({
        where: { organizationId },
        data: {
          status: SubStatus.ACTIVE,
          canceledAt: null,
          cancelReason: null,
          trialEndsAt: null,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingAt: periodEnd,
          monthlyOrderLimit: limits.monthlyOrderLimit,
          marketplaceLimit: limits.marketplaceLimit,
          ecommerceLimit: limits.ecommerceLimit,
          erpLimit: limits.erpLimit,
          userLimit: limits.userLimit,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          actorOrgId: organizationId,
          impersonatedOrgId: null,
          action: 'subscription.reactivated',
          resourceType: 'Subscription',
          resourceId: next.id,
          metadata: {
            plan: sub.plan,
            periodEnd: periodEnd.toISOString(),
          },
        },
      });
      return next;
    });

    try {
      await this.inAppNotificationService.create({
        organizationId,
        type: NotificationType.SYSTEM,
        title: 'Abonelik yeniden aktif',
        message: `Aboneliğiniz yeniden etkinleştirildi. Dönem bitişi: ${periodEnd.toLocaleDateString('tr-TR')}.`,
        link: '/settings/subscription',
        metadata: { plan: sub.plan },
      });
    } catch (notifyErr) {
      this.logger.warn('Yeniden aktivasyon bildirimi oluşturulamadı', {
        organizationId,
        message: notifyErr instanceof Error ? notifyErr.message : 'unknown',
      });
    }

    await this.invalidateSubscriptionCache(organizationId);
    return updated;
  }

  async getUsageStats(organizationId: string): Promise<UsageStats> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }

    const usageLimits = USAGE_PLAN_LIMITS[sub.plan];
    const defaults = PLAN_LIMITS[sub.plan];
    const orderLimit =
      usageLimits.ordersPerMonth < 0
        ? null
        : usageLimits.ordersPerMonth;
    const connectionLimit =
      usageLimits.connections < 0
        ? null
        : usageLimits.connections;
    const productLimit =
      usageLimits.products < 0 ? null : usageLimits.products;
    const apiKeyLimit =
      usageLimits.apiKeys < 0 ? null : usageLimits.apiKeys;
    const ecommerceLimit = sub.ecommerceLimit ?? defaults.ecommerceLimit;
    const erpLimit = sub.erpLimit ?? defaults.erpLimit;
    const userLimit = sub.userLimit ?? defaults.userLimit;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      ordersThisMonth,
      connectionCount,
      productCount,
      apiKeyCount,
      ecommerceCount,
      erpCount,
      userCount,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.marketplaceConnection.count({
        where: { organizationId, isActive: true, deletedAt: null },
      }),
      this.prisma.product.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.apiKey.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.ecommerceConnection.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.erpConnection.count({
        where: { organizationId, isActive: true, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { organizationId, deletedAt: null },
      }),
    ]);

    let trialDaysLeft: number | null = null;
    if (sub.status === SubStatus.TRIAL && sub.trialEndsAt) {
      const diff = Math.ceil(
        (sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000,
      );
      trialDaysLeft = diff > 0 ? diff : 0;
    }

    const connections = { used: connectionCount, limit: connectionLimit };
    const products = { used: productCount, limit: productLimit };
    const orders = { used: ordersThisMonth, limit: orderLimit };
    const apiKeys = { used: apiKeyCount, limit: apiKeyLimit };

    return {
      connections,
      products,
      orders,
      apiKeys,
      marketplaces: connections,
      ecommerce: { used: ecommerceCount, limit: ecommerceLimit },
      erp: { used: erpCount, limit: erpLimit },
      users: { used: userCount, limit: userLimit },
      trialDaysLeft,
    };
  }

  private amountForPlan(plan: PlanTier, billingPeriod: BillingPeriod): number {
    const yearlyKurus = PLAN_PRICES_KURUS[plan];
    if (billingPeriod === BillingPeriod.YEARLY) {
      return yearlyKurus;
    }
    return Math.round(yearlyKurus / 12);
  }

  private priceTryForIyzico(plan: PlanTier, billingPeriod: BillingPeriod): number {
    return this.amountForPlan(plan, billingPeriod) / 100;
  }

  private periodEndFromBilling(billingPeriod: BillingPeriod, start: Date): Date {
    const end = new Date(start);
    if (billingPeriod === BillingPeriod.YEARLY) {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    return end;
  }

  private async ensureIyzicoPricingPlanRef(
    plan: PlanTier,
    billingPeriod: BillingPeriod,
  ): Promise<string> {
    const cached = await this.prisma.iyzicoPricingPlan.findUnique({
      where: { plan_billingPeriod: { plan, billingPeriod } },
    });
    if (cached) {
      return cached.pricingPlanRefCode;
    }

    const productName = `Senkronize ${plan}`;
    const productRef = await this.iyzicoService.createSubscriptionProduct(
      productName,
      'tr',
    );
    const pricingPlanRef = await this.iyzicoService.createSubscriptionPricingPlan(
      productRef,
      {
        name: `${PLAN_LABEL_TR[plan]} (${billingPeriod === BillingPeriod.YEARLY ? 'Yıllık' : 'Aylık'})`,
        priceTry: this.priceTryForIyzico(plan, billingPeriod),
        billingPeriod,
      },
    );

    await this.prisma.iyzicoPricingPlan.create({
      data: {
        plan,
        billingPeriod,
        productRefCode: productRef,
        pricingPlanRefCode: pricingPlanRef,
      },
    });
    return pricingPlanRef;
  }

  async startSubscription(
    organizationId: string,
    actor: AuthenticatedUser,
    plan: PlanTier,
    billingPeriod: BillingPeriod,
  ): Promise<CheckoutUrlResult> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    const pricingPlanRef = await this.ensureIyzicoPricingPlanRef(
      plan,
      billingPeriod,
    );
    const conversationId = randomUUID();
    const amount = this.amountForPlan(plan, billingPeriod);
    const callbackUrl =
      this.config.get<string>('IYZICO_CALLBACK_URL') ??
      `${this.panelBaseUrl()}/payment/callback`;

    await this.prisma.payment.create({
      data: {
        organizationId,
        amount,
        currency: 'TRY',
        status: PaymentStatus.PENDING,
        plan,
        billingPeriod,
        iyzicoConversationId: conversationId,
      },
    });

    const checkout = await this.iyzicoService.createCheckoutForm({
      conversationId,
      callbackUrl,
      pricingPlanReferenceCode: pricingPlanRef,
      customer: this.iyzicoService.buildCustomerPayload(actor, org),
    });

    if (!checkout.paymentPageUrl && !checkout.token) {
      await this.prisma.payment.updateMany({
        where: {
          iyzicoConversationId: conversationId,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.FAILED,
          failReason: 'iyzico_checkout_init_failed',
        },
      });
      throw new BadRequestException(
        'Ödeme sayfası oluşturulamadı. Lütfen daha sonra tekrar deneyin.',
      );
    }

    if (checkout.token) {
      await this.prisma.payment.updateMany({
        where: { iyzicoConversationId: conversationId },
        data: { iyzicoCheckoutToken: checkout.token },
      });
    }

    const checkoutUrl =
      checkout.paymentPageUrl ??
      `${this.config.get<string>('IYZICO_CHECKOUT_BASE', 'https://sandbox-cpp.iyzipay.com')}?token=${checkout.token}`;

    return {
      checkoutUrl,
      conversationId,
      token: checkout.token,
    };
  }

  async completeIyzicoCheckout(
    organizationId: string,
    token: string,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.iyzicoService.retrieveCheckoutForm(token);
    if (result.status !== 'success' || !result.subscriptionReferenceCode) {
      return {
        success: false,
        message:
          result.errorMessage ??
          'Ödeme doğrulanamadı. Lütfen tekrar deneyin veya destek ile iletişime geçin.',
      };
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        organizationId,
        iyzicoCheckoutToken: token,
        status: PaymentStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      const byConversation = await this.prisma.payment.findFirst({
        where: { organizationId, status: PaymentStatus.PENDING },
        orderBy: { createdAt: 'desc' },
      });
      if (!byConversation) {
        return { success: false, message: 'Bekleyen ödeme kaydı bulunamadı.' };
      }
      await this.activateSubscriptionFromIyzicoPayment(
        byConversation.id,
        result.subscriptionReferenceCode,
        result.customerReferenceCode,
      );
      return { success: true, message: 'Aboneliğiniz aktifleştirildi.' };
    }

    await this.activateSubscriptionFromIyzicoPayment(
      payment.id,
      result.subscriptionReferenceCode,
      result.customerReferenceCode,
    );
    return { success: true, message: 'Aboneliğiniz aktifleştirildi.' };
  }

  async upgradeSubscription(
    organizationId: string,
    actorUserId: string,
    newPlan: PlanTier,
  ): Promise<PlanUpgradeRequestResult> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    if (sub.plan === newPlan) {
      throw new BadRequestException('Zaten bu plandasınız.');
    }
    if (PLAN_TIER_RANK[newPlan] <= PLAN_TIER_RANK[sub.plan]) {
      throw new BadRequestException(
        'Yalnızca daha üst bir pakete yükseltme yapılabilir.',
      );
    }

    const billingPeriod = sub.billingPeriod ?? BillingPeriod.YEARLY;
    const iyzicoSub = await this.prisma.iyzicoSubscription.findUnique({
      where: { organizationId },
    });

    if (iyzicoSub?.subscriptionRefCode) {
      const newPlanRef = await this.ensureIyzicoPricingPlanRef(
        newPlan,
        billingPeriod,
      );
      await this.iyzicoService.upgradeSubscription(
        iyzicoSub.subscriptionRefCode,
        newPlanRef,
      );
      await this.changePlan(organizationId, actorUserId, newPlan);
      return { message: 'Paketiniz yükseltildi.' };
    }

    return this.requestPlanUpgrade(organizationId, actorUserId, newPlan);
  }

  async handleIyzicoWebhook(payload: IyzicoWebhookPayload): Promise<void> {
    const event = normalizeIyzicoEventType(
      payload.iyziEventType ?? payload.eventType,
    );
    if (!event) {
      this.logger.warn('Iyzico webhook: bilinmeyen event tipi');
      return;
    }

    const subscriptionRef = payload.subscriptionReferenceCode?.trim();
    const orderRef = payload.orderReferenceCode?.trim();

    if (event === 'SUBSCRIPTION_ORDER_SUCCESS') {
      const payment = orderRef
        ? await this.prisma.payment.findFirst({
            where: {
              OR: [
                { iyzicoOrderReference: orderRef },
                { iyzicoConversationId: orderRef },
              ],
            },
          })
        : null;

      if (payment && subscriptionRef) {
        await this.activateSubscriptionFromIyzicoPayment(
          payment.id,
          subscriptionRef,
          payload.customerReferenceCode,
          orderRef,
        );
      } else if (subscriptionRef) {
        const iyzicoSub = await this.prisma.iyzicoSubscription.findFirst({
          where: { subscriptionRefCode: subscriptionRef },
        });
        if (iyzicoSub) {
          const pending = await this.prisma.payment.findFirst({
            where: {
              organizationId: iyzicoSub.organizationId,
              status: PaymentStatus.PENDING,
            },
            orderBy: { createdAt: 'desc' },
          });
          if (pending) {
            await this.activateSubscriptionFromIyzicoPayment(
              pending.id,
              subscriptionRef,
              payload.customerReferenceCode,
              orderRef,
            );
          }
        }
      }
      return;
    }

    if (event === 'SUBSCRIPTION_ORDER_FAILURE') {
      if (!orderRef) {
        return;
      }
      await this.prisma.payment.updateMany({
        where: {
          OR: [
            { iyzicoOrderReference: orderRef },
            { iyzicoConversationId: orderRef },
          ],
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.FAILED,
          failReason: 'iyzico_subscription_order_failure',
        },
      });
      return;
    }

    if (event === 'SUBSCRIPTION_CANCELED' && subscriptionRef) {
      const iyzicoSub = await this.prisma.iyzicoSubscription.findFirst({
        where: { subscriptionRefCode: subscriptionRef },
        include: { organization: { include: { subscription: true } } },
      });
      const orgSub = iyzicoSub?.organization.subscription;
      if (orgSub) {
        await this.prisma.subscription.update({
          where: { organizationId: orgSub.organizationId },
          data: {
            status: SubStatus.CANCELLED,
            subscriptionEndsAt: orgSub.subscriptionEndsAt ?? orgSub.currentPeriodEnd,
          },
        });
        await this.invalidateSubscriptionCache(orgSub.organizationId);
      }
      return;
    }

    if (event === 'SUBSCRIPTION_UPGRADED' && subscriptionRef) {
      this.logger.log('Iyzico abonelik yükseltildi', { subscriptionRef });
    }
  }

  private async activateSubscriptionFromIyzicoPayment(
    paymentId: string,
    subscriptionRefCode: string,
    customerRefCode?: string,
    orderReferenceCode?: string,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      return;
    }
    if (payment.status === PaymentStatus.SUCCESS) {
      return;
    }

    const periodStart = new Date();
    const billingPeriod = payment.billingPeriod ?? BillingPeriod.YEARLY;
    const periodEnd = this.periodEndFromBilling(billingPeriod, periodStart);
    const nextBilling = new Date(periodEnd);
    const limits = PLAN_LIMITS[payment.plan];

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          periodStart,
          periodEnd,
          ...(orderReferenceCode
            ? { iyzicoOrderReference: orderReferenceCode }
            : {}),
        },
      });

      await tx.subscription.update({
        where: { organizationId: payment.organizationId },
        data: {
          plan: payment.plan,
          status: SubStatus.ACTIVE,
          billingPeriod,
          trialEndsAt: null,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingAt: nextBilling,
          subscriptionEndsAt: null,
          canceledAt: null,
          cancelReason: null,
          monthlyOrderLimit: limits.monthlyOrderLimit,
          marketplaceLimit: limits.marketplaceLimit,
          ecommerceLimit: limits.ecommerceLimit,
          erpLimit: limits.erpLimit,
          userLimit: limits.userLimit,
        },
      });

      await tx.iyzicoSubscription.upsert({
        where: { organizationId: payment.organizationId },
        create: {
          organizationId: payment.organizationId,
          subscriptionRefCode,
          customerRefCode: customerRefCode ?? null,
        },
        update: {
          subscriptionRefCode,
          ...(customerRefCode ? { customerRefCode } : {}),
        },
      });
    });

    const paymentAmountTry = payment.amount / 100;
    await this.partnerService.recordCommission(
      payment.organizationId,
      paymentAmountTry,
      `Abonelik ödemesi (${payment.plan})`,
      payment.id,
    );

    try {
      await this.inAppNotificationService.create({
        organizationId: payment.organizationId,
        type: NotificationType.SYSTEM,
        title: 'Abonelik aktif',
        message: `${PLAN_LABEL_TR[payment.plan]} aboneliğiniz başarıyla aktifleştirildi.`,
        link: '/settings/subscription',
        metadata: { plan: payment.plan },
      });
    } catch (notifyErr) {
      this.logger.warn('Abonelik aktivasyon bildirimi oluşturulamadı', {
        organizationId: payment.organizationId,
        message: notifyErr instanceof Error ? notifyErr.message : 'unknown',
      });
    }

    await this.invalidateSubscriptionCache(payment.organizationId);
  }

  async requestPlanUpgrade(
    organizationId: string,
    actorUserId: string,
    requestedPlan: PlanTier,
  ): Promise<PlanUpgradeRequestResult> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        actorOrgId: organizationId,
        impersonatedOrgId: null,
        action: 'subscription.plan_upgrade_requested',
        resourceType: 'Subscription',
        resourceId: sub.id,
        metadata: {
          currentPlan: sub.plan,
          requestedPlan,
        },
      },
    });

    return {
      message: 'Talebiniz alındı, ekibimiz sizinle iletişime geçecek.',
    };
  }

  async getInvoiceList(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
  }> {
    const history = await this.getPaymentHistory(organizationId, page, limit);
    if (history.total > 0) {
      return history;
    }

    const mockItems = [
      {
        id: 'mock-inv-2026',
        organizationId,
        amount: 599_000,
        currency: 'TRY',
        status: PaymentStatus.SUCCESS,
        plan: PlanTier.PRO,
        paytrOrderId: null,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2027-01-01'),
        failReason: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 'mock-inv-2025',
        organizationId,
        amount: 599_000,
        currency: 'TRY',
        status: PaymentStatus.SUCCESS,
        plan: PlanTier.PRO,
        paytrOrderId: null,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2026-01-01'),
        failReason: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      },
    ];

    return {
      items: mockItems,
      total: mockItems.length,
      page: 1,
      limit,
    };
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
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
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
            canceledAt: null,
            cancelReason: null,
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

      const paymentAmountTry = totalKurus / 100;
      await this.partnerService.recordCommission(
        payment.organizationId,
        paymentAmountTry,
        `Abonelik ödemesi (${payment.plan})`,
        payment.id,
      );

      const ownerForEmail = await this.prisma.user.findFirst({
        where: {
          organizationId: payment.organizationId,
          role: UserRole.OWNER,
          deletedAt: null,
        },
      });
      if (ownerForEmail?.email) {
        const organization = await this.prisma.organization.findFirst({
          where: { id: payment.organizationId, deletedAt: null },
        });
        const totalTry = totalKurus / 100;
        const amountExclVat = totalTry / 1.2;
        const vatAmount = totalTry - amountExclVat;
        const addressParts = [organization?.address, organization?.city].filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );
        const invoiceData: InvoiceEmailData = {
          recipientName: ownerForEmail.name ?? 'Merhaba',
          invoiceNumber: `INV-${payment.id.slice(-10).toUpperCase()}`,
          invoiceDate: periodStart.toLocaleDateString('tr-TR'),
          companyName: organization?.name ?? '—',
          companyTaxId: organization?.taxNumber ?? '',
          companyAddress: addressParts.join('\n'),
          planName: PLAN_LABEL_TR[payment.plan],
          billingPeriodLabel: `${periodStart.toLocaleDateString('tr-TR')} — ${periodEnd.toLocaleDateString('tr-TR')}`,
          amountExclVatTry: formatTryAmount(amountExclVat),
          vatRatePercent: '%20',
          vatAmountTry: formatTryAmount(vatAmount),
          totalInclVatTry: formatTryAmount(totalTry),
          invoiceDownloadUrl: `${this.panelBaseUrl()}/settings/subscription`,
          nextPaymentDate: nextBilling.toLocaleDateString('tr-TR'),
        };
        void this.emailService
          .sendSubscriptionConfirm(ownerForEmail.email, invoiceData)
          .catch((error: unknown) => {
            this.logger.error('Abonelik onay e-postası gönderilemedi', {
              organizationId: payment.organizationId,
              error,
            });
          });
      }
      await this.invalidateSubscriptionCache(payment.organizationId);
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
