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
  OrgProductLine,
  PaymentStatus,
  PlanTier,
  SubStatus,
  UserRole,
  type Subscription,
  type User,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PostHogService } from '../analytics/posthog.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EncryptionService } from '../common/encryption/encryption.service';
import { EmailService } from '../notifications/email/email.service';
import type { InvoiceEmailData } from '../notifications/email/email-template.types';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { PartnerService } from '../partner/partner.service';
import { isBillingExempt } from '../organization/organization-internal';
import { CacheKeys } from '../common/cache/cache-keys';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { IyzicoService } from '../payment/iyzico.service';
import {
  normalizeIyzicoEventType,
  type IyzicoWebhookPayload,
} from '../payment/iyzico.types';
import { resolveEffectivePlanTier } from './subscription-effective-plan';
import { PaytrService } from './paytr.service';
import type { PaytrWebhookPayload } from './paytr.types';
import { isInternalAccount } from '../organization/organization-internal';
import { effectiveErpSlotLimit } from '../erp-connection/erp-slot-limit.util';
import { OutboundWebhookService } from '../webhook/outbound-webhook.service';
import { WebhookEvent } from '../webhook/webhook-event.enum';
import { InvoiceService } from '../invoice/invoice.service';
import type {
  CheckoutUrlResult,
  PlanUpgradeRequestResult,
  UsageOverview,
  UsageStats,
} from './subscription.types';
import {
  mergeOrgProductLine,
  orgHasProductLine,
  resolveOrgProductLines,
  type ResolvedOrgProductLine,
} from '../common/product-lines';
import {
  PLAN_TIER_RANK,
  dbLimitsForPlan,
  effectiveLimit,
  planLimitFeatureLines,
  toUsageLimit,
} from './plan-limits';

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


function formatTryAmount(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount);
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
    private readonly posthog: PostHogService,
    private readonly outboundWebhookService: OutboundWebhookService,
    private readonly invoiceService: InvoiceService,
  ) {}

  /** Panel taban URL (e-posta bağlantıları) */
  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  /** DB'de limit null ise paket varsayılanı */
  effectiveMarketplaceLimit(subscription: Subscription): number {
    return effectiveLimit(
      subscription.marketplaceLimit,
      subscription.plan,
      'marketplaces',
    );
  }

  private async invalidateSubscriptionCache(
    organizationId: string,
  ): Promise<void> {
    await this.cache.del(CacheKeys.subscription(organizationId));
  }

  async getOrgProducts(organizationId: string): Promise<ResolvedOrgProductLine[]> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { productLines: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    return resolveOrgProductLines(org.productLines);
  }

  /**
   * Self-service stub: ödeme akışı olmadan organizasyona ürün hattı ekler.
   */
  async addProductLine(
    organizationId: string,
    actorUserId: string,
    productLine: OrgProductLine,
    isImpersonating = false,
  ): Promise<{ productLines: ResolvedOrgProductLine[] }> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, productLines: true },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    const current = resolveOrgProductLines(org.productLines);
    if (orgHasProductLine(current, productLine)) {
      throw new BadRequestException('Bu ürün hattı zaten etkin.');
    }

    const productLines = mergeOrgProductLine(org.productLines, productLine);

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { productLines },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          actorOrgId: organizationId,
          impersonatedOrgId: isImpersonating ? organizationId : null,
          action: 'subscription.product_line_added',
          resourceType: 'Organization',
          resourceId: organizationId,
          metadata: {
            productLine,
            previousLines: current,
            productLines,
            stub: true,
          },
        },
      });
    });

    return { productLines };
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
    const limits = dbLimitsForPlan(newPlan);

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

    if (PLAN_TIER_RANK[newPlan] > PLAN_TIER_RANK[previousPlan]) {
      this.posthog.capture(actorUserId, 'subscription_upgraded', {
        from: previousPlan,
        to: newPlan,
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

    this.posthog.capture(actorUserId, 'subscription_cancelled', {
      plan: sub.plan,
      reason: trimmedReason,
    });

    void this.outboundWebhookService.dispatch(
      organizationId,
      WebhookEvent.SUBSCRIPTION_CANCELLED,
      {
        organizationId,
        plan: sub.plan,
        reason: trimmedReason,
        effectiveUntil: subscriptionEndsAt.toISOString(),
      },
    );

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
    const limits = dbLimitsForPlan(sub.plan);

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

  async getUsageOverview(organizationId: string): Promise<UsageOverview> {
    const [sub, org] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { organizationId },
      }),
      this.prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: { metadata: true, slug: true },
      }),
    ]);
    if (!sub) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    const effectivePlan = resolveEffectivePlanTier(sub);
    const erpConnectionLimit = effectiveErpSlotLimit({
      subscription: sub,
      isInternalAccount: isInternalAccount(org),
    });

    const marketplaceLimit = toUsageLimit(
      effectiveLimit(sub.marketplaceLimit, effectivePlan, 'marketplaces'),
    );
    const productLimit = toUsageLimit(
      effectiveLimit(null, effectivePlan, 'products'),
    );
    const orderLimit = toUsageLimit(
      effectiveLimit(sub.monthlyOrderLimit, effectivePlan, 'orders'),
    );
    const userLimit = toUsageLimit(
      effectiveLimit(sub.userLimit, effectivePlan, 'users'),
    );
    const warehouseLimit = toUsageLimit(
      effectiveLimit(sub.erpLimit, effectivePlan, 'warehouses'),
    );
    const apiCallsLimit = toUsageLimit(
      effectiveLimit(null, effectivePlan, 'apiCallsPerDay'),
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateKey = now.toISOString().slice(0, 10);

    const [
      ordersThisMonth,
      marketplaceCount,
      productCount,
      userCount,
      warehouseCount,
      erpConnectionCount,
      apiCallsToday,
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
      this.prisma.user.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.warehouse.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.erpConnection.count({
        where: { organizationId, isActive: true, deletedAt: null },
      }),
      this.getApiCallsToday(organizationId, dateKey),
    ]);

    let trialDaysLeft: number | null = null;
    if (sub.status === SubStatus.TRIAL && sub.trialEndsAt) {
      const diff = Math.ceil(
        (sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000,
      );
      trialDaysLeft = diff > 0 ? diff : 0;
    }

    const renewsAt =
      sub.nextBillingAt?.toISOString() ??
      sub.currentPeriodEnd?.toISOString() ??
      null;
    const renewalTarget = sub.nextBillingAt ?? sub.currentPeriodEnd;
    const daysLeft = renewalTarget
      ? Math.max(
          0,
          Math.ceil((renewalTarget.getTime() - now.getTime()) / 86_400_000),
        )
      : null;

    const orgProducts = await this.getOrgProducts(organizationId);

    return {
      plan: sub.plan,
      orgProducts,
      usage: {
        marketplaces: { used: marketplaceCount, limit: marketplaceLimit },
        products: { used: productCount, limit: productLimit },
        orders: { used: ordersThisMonth, limit: orderLimit },
        users: { used: userCount, limit: userLimit },
        warehouses: { used: warehouseCount, limit: warehouseLimit },
        erpConnections: {
          used: erpConnectionCount,
          limit: erpConnectionLimit,
        },
        apiCallsToday: { used: apiCallsToday, limit: apiCallsLimit },
      },
      renewsAt,
      daysLeft,
      trialDaysLeft,
    };
  }

  /** @deprecated getUsageOverview kullanın */
  async getUsageStats(organizationId: string): Promise<UsageStats> {
    const overview = await this.getUsageOverview(organizationId);
    return {
      connections: overview.usage.marketplaces,
      products: overview.usage.products,
      orders: overview.usage.orders,
      apiKeys: overview.usage.apiCallsToday,
      marketplaces: overview.usage.marketplaces,
      ecommerce: overview.usage.marketplaces,
      erp: overview.usage.erpConnections,
      users: overview.usage.users,
      warehouses: overview.usage.warehouses,
      apiCallsToday: overview.usage.apiCallsToday,
      trialDaysLeft: overview.trialDaysLeft,
    };
  }

  private async getApiCallsToday(
    organizationId: string,
    dateKey: string,
  ): Promise<number> {
    const raw = await this.cache.get<{ count: number }>(
      CacheKeys.apiCallsDaily(organizationId, dateKey),
    );
    return raw?.count ?? 0;
  }

  async recordApiCall(organizationId: string): Promise<void> {
    const dateKey = new Date().toISOString().slice(0, 10);
    const key = CacheKeys.apiCallsDaily(organizationId, dateKey);
    const current = (await this.cache.get<{ count: number }>(key))?.count ?? 0;
    await this.cache.set(key, { count: current + 1 }, 86_400);
  }

  private calculateProrationKurus(
    sub: Subscription,
    newPlan: PlanTier,
  ): number {
    const billingPeriod = sub.billingPeriod ?? BillingPeriod.YEARLY;
    const oldPrice = this.amountForPlan(sub.plan, billingPeriod);
    const newPrice = this.amountForPlan(newPlan, billingPeriod);
    const now = new Date();
    const msRemaining = Math.max(
      0,
      sub.currentPeriodEnd.getTime() - now.getTime(),
    );
    const msTotal = Math.max(
      1,
      sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime(),
    );
    const priceDiff = Math.max(0, newPrice - oldPrice);
    return Math.round((msRemaining / msTotal) * priceDiff);
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

    const conversationId = `${organizationId}-${Date.now()}`;
    const amount = this.amountForPlan(plan, billingPeriod);
    const callbackUrl =
      this.config.get<string>('IYZICO_CALLBACK_URL') ??
      `${this.panelBaseUrl()}/payment/callback`;
    const priceTry = amount / 100;

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

    const checkout = await this.iyzicoService.createSubscriptionCheckout({
      userId: actor.id,
      orgId: organizationId,
      plan,
      billingPeriod,
      email: actor.email,
      name: actor.name ?? actor.email,
      priceTry,
      callbackUrl,
      conversationId,
      orgCity: org.city,
      orgAddress: org.address,
    });

    if (!checkout.checkoutFormContent || !checkout.token) {
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

    await this.prisma.payment.updateMany({
      where: { iyzicoConversationId: conversationId },
      data: { iyzicoCheckoutToken: checkout.token },
    });

    const checkoutUrl =
      `${this.config.get<string>('IYZICO_CHECKOUT_BASE', 'https://sandbox-cpp.iyzipay.com')}?token=${checkout.token}`;

    return {
      checkoutUrl,
      checkoutFormContent: checkout.checkoutFormContent,
      conversationId: checkout.conversationId,
      token: checkout.token,
      tokenExpireTime: checkout.tokenExpireTime,
    };
  }

  async completeIyzicoCheckout(
    organizationId: string,
    token: string,
  ): Promise<{ success: boolean; message: string; plan?: PlanTier }> {
    const result = await this.iyzicoService.handleCallback(token);
    if (!result.success) {
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
        OR: [
          { iyzicoCheckoutToken: token },
          { iyzicoConversationId: result.conversationId },
        ],
        status: PaymentStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return { success: false, message: 'Bekleyen ödeme kaydı bulunamadı.' };
    }

    await this.activateSubscriptionFromIyzicoPayment(payment.id, {
      orderReferenceCode: result.orderId,
      cardUserKey: result.cardUserKey,
      cardToken: result.cardToken,
      cardLastFour: result.cardLastFour,
    });

    return {
      success: true,
      message: 'Aboneliğiniz aktifleştirildi.',
      plan: result.plan,
    };
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
    if (sub.status !== SubStatus.ACTIVE && sub.status !== SubStatus.TRIAL) {
      throw new BadRequestException(
        'Yükseltme yalnızca aktif veya deneme aboneliklerinde yapılabilir.',
      );
    }
    if (sub.plan === newPlan) {
      throw new BadRequestException('Zaten bu plandasınız.');
    }
    if (PLAN_TIER_RANK[newPlan] <= PLAN_TIER_RANK[sub.plan]) {
      throw new BadRequestException(
        'Yalnızca daha üst bir pakete yükseltme yapılabilir.',
      );
    }

    const previousPlan = sub.plan;
    const prorationKurus = this.calculateProrationKurus(sub, newPlan);
    const prorationAmountTry = prorationKurus / 100;
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
      void this.outboundWebhookService.dispatch(
        organizationId,
        WebhookEvent.SUBSCRIPTION_UPGRADED,
        {
          organizationId,
          fromPlan: previousPlan,
          toPlan: newPlan,
          prorationAmountTry,
        },
      );
      return {
        message: 'Paketiniz yükseltildi.',
        prorationAmountTry,
      };
    }

    const actor = await this.prisma.user.findFirst({
      where: { id: actorUserId, organizationId, deletedAt: null },
    });
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });

    if (actor && org) {
      try {
        const checkout = await this.createUpgradeCheckout(
          organizationId,
          actor,
          newPlan,
          billingPeriod,
          Math.max(prorationKurus, 1),
        );
        await this.prisma.auditLog.create({
          data: {
            actorUserId,
            actorOrgId: organizationId,
            impersonatedOrgId: null,
            action: 'subscription.plan_upgrade_requested',
            resourceType: 'Subscription',
            resourceId: sub.id,
            metadata: {
              currentPlan: previousPlan,
              requestedPlan: newPlan,
              prorationAmountTry,
            },
          },
        });
        return {
          message: 'Yükseltme için ödeme adımına yönlendiriliyorsunuz.',
          prorationAmountTry,
          checkoutUrl: checkout.checkoutUrl,
          conversationId: checkout.conversationId,
        };
      } catch (err) {
        this.logger.warn('Yükseltme checkout oluşturulamadı', {
          organizationId,
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    return this.requestPlanUpgrade(
      organizationId,
      actorUserId,
      newPlan,
      prorationAmountTry,
    );
  }

  private async createUpgradeCheckout(
    organizationId: string,
    actor: User,
    plan: PlanTier,
    billingPeriod: BillingPeriod,
    amountKurus: number,
  ): Promise<CheckoutUrlResult> {
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
    const callbackUrl =
      this.config.get<string>('IYZICO_CALLBACK_URL') ??
      `${this.panelBaseUrl()}/payment/callback`;

    await this.prisma.payment.create({
      data: {
        organizationId,
        amount: amountKurus,
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
      throw new BadRequestException('Ödeme sayfası oluşturulamadı.');
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
        await this.activateSubscriptionFromIyzicoPayment(payment.id, {
          subscriptionRefCode: subscriptionRef,
          customerRefCode: payload.customerReferenceCode,
          orderReferenceCode: orderRef,
        });
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
            await this.activateSubscriptionFromIyzicoPayment(pending.id, {
              subscriptionRefCode: subscriptionRef,
              customerRefCode: payload.customerReferenceCode,
              orderReferenceCode: orderRef,
            });
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
    options: {
      subscriptionRefCode?: string;
      customerRefCode?: string;
      orderReferenceCode?: string;
      cardUserKey?: string;
      cardToken?: string;
      cardLastFour?: string;
    } = {},
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
    const limits = dbLimitsForPlan(payment.plan);

    const cardUserKeyEnc =
      options.cardUserKey != null
        ? this.encryptionService.encrypt(options.cardUserKey)
        : undefined;
    const cardTokenEnc =
      options.cardToken != null
        ? this.encryptionService.encrypt(options.cardToken)
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          periodStart,
          periodEnd,
          ...(options.orderReferenceCode
            ? { iyzicoOrderReference: options.orderReferenceCode }
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
          subscriptionRefCode: options.subscriptionRefCode ?? null,
          customerRefCode: options.customerRefCode ?? null,
          ...(cardUserKeyEnc ? { cardUserKeyEnc } : {}),
          ...(cardTokenEnc ? { cardTokenEnc } : {}),
          ...(options.cardLastFour ? { cardLastFour: options.cardLastFour } : {}),
        },
        update: {
          ...(options.subscriptionRefCode
            ? { subscriptionRefCode: options.subscriptionRefCode }
            : {}),
          ...(options.customerRefCode ? { customerRefCode: options.customerRefCode } : {}),
          ...(cardUserKeyEnc ? { cardUserKeyEnc } : {}),
          ...(cardTokenEnc ? { cardTokenEnc } : {}),
          ...(options.cardLastFour ? { cardLastFour: options.cardLastFour } : {}),
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

    await this.sendSubscriptionPaymentEmails(
      payment.organizationId,
      payment.plan,
      paymentAmountTry,
      periodStart,
      periodEnd,
      nextBilling,
      options.orderReferenceCode,
    );

    await this.invalidateSubscriptionCache(payment.organizationId);
  }

  private async sendSubscriptionPaymentEmails(
    organizationId: string,
    plan: PlanTier,
    totalTry: number,
    periodStart: Date,
    periodEnd: Date,
    nextBilling: Date,
    paymentId?: string,
  ): Promise<void> {
    const owner = await this.prisma.user.findFirst({
      where: { organizationId, role: UserRole.OWNER, deletedAt: null },
    });
    if (!owner?.email) {
      return;
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });

    if (!organization || isBillingExempt(organization)) {
      return;
    }

    try {
      const invoice = await this.invoiceService.createFromSubscriptionPayment(
        organizationId,
        {
          planName: PLAN_LABEL_TR[plan],
          amountTry: totalTry,
          periodStart,
          periodEnd,
          customerName: owner.name ?? organization?.name ?? 'Müşteri',
          customerEmail: owner.email,
          customerAddress: [organization?.address, organization?.city]
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .join(', '),
          customerTaxId: organization?.taxNumber ?? undefined,
          paymentId,
        },
      );

      const { buffer: pdfBuffer } =
        await this.invoiceService.generateInvoicePdfBuffer(
          organizationId,
          invoice.id,
        );

      const amountExclVat = totalTry / 1.2;
      const vatAmount = totalTry - amountExclVat;
      const addressParts = [organization?.address, organization?.city].filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      );
      const invoiceData: InvoiceEmailData = {
        recipientName: owner.name ?? 'Merhaba',
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: periodStart.toLocaleDateString('tr-TR'),
        companyName: organization?.name ?? '—',
        companyTaxId: organization?.taxNumber ?? '',
        companyAddress: addressParts.join('\n'),
        planName: PLAN_LABEL_TR[plan],
        billingPeriodLabel: `${periodStart.toLocaleDateString('tr-TR')} — ${periodEnd.toLocaleDateString('tr-TR')}`,
        amountExclVatTry: formatTryAmount(amountExclVat),
        vatRatePercent: '%20',
        vatAmountTry: formatTryAmount(vatAmount),
        totalInclVatTry: formatTryAmount(totalTry),
        invoiceDownloadUrl: `${this.panelBaseUrl()}/settings/subscription`,
        nextPaymentDate: nextBilling.toLocaleDateString('tr-TR'),
      };

      void this.emailService
        .sendSubscriptionConfirmWithPdf(owner.email, invoiceData, pdfBuffer)
        .catch((error: unknown) => {
          this.logger.error('Abonelik fatura e-postası gönderilemedi', {
            organizationId,
            error,
          });
        });

      void this.emailService
        .sendWelcome(owner.email, owner.name ?? 'Merhaba')
        .catch((error: unknown) => {
          this.logger.error('Hoş geldin e-postası gönderilemedi', {
            organizationId,
            error,
          });
        });

      void this.emailService
        .sendSubscriptionActivatedWithFeatures(
          owner.email,
          PLAN_LABEL_TR[plan],
          planLimitFeatureLines(plan),
        )
        .catch((error: unknown) => {
          this.logger.error('Abonelik aktivasyon e-postası gönderilemedi', {
            organizationId,
            error,
          });
        });
    } catch (err) {
      this.logger.error('Abonelik faturası oluşturulamadı', {
        organizationId,
        error: err,
      });
    }
  }

  async renewIyzicoSubscription(organizationId: string): Promise<void> {
    await this.iyzicoService.renewSubscription(organizationId);

    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      return;
    }

    const periodStart = new Date();
    const billingPeriod = sub.billingPeriod ?? BillingPeriod.YEARLY;
    const periodEnd = this.periodEndFromBilling(billingPeriod, periodStart);
    const nextBilling = new Date(periodEnd);
    const amount = this.amountForPlan(sub.plan, billingPeriod);

    const payment = await this.prisma.payment.create({
      data: {
        organizationId,
        amount,
        currency: 'TRY',
        status: PaymentStatus.SUCCESS,
        plan: sub.plan,
        billingPeriod,
        periodStart,
        periodEnd,
        iyzicoConversationId: `${organizationId}-renew-${Date.now()}`,
      },
    });

    await this.prisma.subscription.update({
      where: { organizationId },
      data: {
        status: SubStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingAt: nextBilling,
      },
    });

    await this.sendSubscriptionPaymentEmails(
      organizationId,
      sub.plan,
      amount / 100,
      periodStart,
      periodEnd,
      nextBilling,
    );

    await this.partnerService.recordCommission(
      organizationId,
      amount / 100,
      `Abonelik yenileme (${sub.plan})`,
      payment.id,
    );

    await this.invalidateSubscriptionCache(organizationId);
  }

  async requestPlanUpgrade(
    organizationId: string,
    actorUserId: string,
    requestedPlan: PlanTier,
    prorationAmountTry?: number,
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
          prorationAmountTry: prorationAmountTry ?? null,
        },
      },
    });

    return {
      message: 'Talebiniz alındı, ekibimiz sizinle iletişime geçecek.',
      ...(prorationAmountTry != null ? { prorationAmountTry } : {}),
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
      const limits = dbLimitsForPlan(payment.plan);

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
        void this.emailService
          .sendSubscriptionActivatedWithFeatures(
            ownerForEmail.email,
            PLAN_LABEL_TR[payment.plan],
            planLimitFeatureLines(payment.plan),
          )
          .catch((error: unknown) => {
            this.logger.error('Abonelik aktivasyon e-postası gönderilemedi', {
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
