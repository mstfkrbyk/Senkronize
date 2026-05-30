import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BillingPeriod,
  OrgProductLine,
  PlanTier,
  SubStatus,
  type Subscription,
} from '@prisma/client';

import { PostHogService } from '../analytics/posthog.service';
import { CacheService } from '../common/cache/cache.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { EmailService } from '../notifications/email/email.service';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { IyzicoService } from '../payment/iyzico.service';
import { PartnerService } from '../partner/partner.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboundWebhookService } from '../webhook/outbound-webhook.service';
import { InvoiceService } from '../invoice/invoice.service';
import { PaytrService } from './paytr.service';
import { PLAN_LIMITS } from './plan-limits';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  const orgId = 'org-test-1';

  const baseSubscription: Subscription = {
    id: 'sub-1',
    organizationId: orgId,
    plan: PlanTier.GELISIM,
    status: SubStatus.ACTIVE,
    billingPeriod: BillingPeriod.YEARLY,
    trialEndsAt: null,
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2027-01-01'),
    nextBillingAt: new Date('2027-01-01'),
    paytrSubscriptionId: null,
    monthlyOrderLimit: null,
    marketplaceLimit: null,
    ecommerceLimit: null,
    erpLimit: null,
    userLimit: null,
    addons: [],
    canceledAt: null,
    cancelReason: null,
    subscriptionEndsAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const prisma: {
    subscription: { findUnique: jest.Mock };
    organization: { findFirst: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
    order: { count: jest.Mock };
    marketplaceConnection: { count: jest.Mock };
    product: { count: jest.Mock };
    user: { count: jest.Mock };
    warehouse: { count: jest.Mock };
    erpConnection: { count: jest.Mock };
  } = {
    subscription: {
      findUnique: jest.fn(),
    },
    organization: {
      findFirst: jest.fn().mockResolvedValue({
        id: orgId,
        productLines: ['INTEGRATION', 'ACCOUNTING'],
        slug: 'test-org',
        metadata: {},
      }),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    ),
    order: { count: jest.fn() },
    marketplaceConnection: { count: jest.fn() },
    product: { count: jest.fn() },
    user: { count: jest.fn() },
    warehouse: { count: jest.fn() },
    erpConnection: { count: jest.fn() },
  };

  const cache = {
    readThrough: jest.fn(
      async <T>(_key: string, _ttl: number, loader: () => Promise<T>): Promise<T> =>
        loader(),
    ),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.organization.findFirst.mockResolvedValue({
      id: orgId,
      productLines: ['INTEGRATION', 'ACCOUNTING'],
      slug: 'test-org',
      metadata: {},
    });
    prisma.erpConnection.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: PaytrService, useValue: {} },
        { provide: IyzicoService, useValue: {} },
        { provide: EncryptionService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: PartnerService, useValue: {} },
        { provide: InAppNotificationService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PostHogService, useValue: { capture: jest.fn() } },
        { provide: OutboundWebhookService, useValue: {} },
        { provide: InvoiceService, useValue: {} },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  describe('plan limit kontrolleri', () => {
    it.each([
      [PlanTier.BASLANGIC, 3],
      [PlanTier.GELISIM, 10],
      [PlanTier.PRO, 25],
    ] as const)(
      'effectiveMarketplaceLimit — %s paketi en fazla %i pazaryeri',
      (plan, expectedMax) => {
        const limit = service.effectiveMarketplaceLimit({
          ...baseSubscription,
          marketplaceLimit: null,
          plan,
        });
        expect(limit).toBe(expectedMax);
      },
    );

    it('effectiveMarketplaceLimit — KURUMSAL pakette sınırsız (-1)', () => {
      const limit = service.effectiveMarketplaceLimit({
        ...baseSubscription,
        marketplaceLimit: null,
        plan: PlanTier.KURUMSAL,
      });
      expect(limit).toBe(PLAN_LIMITS.KURUMSAL.marketplaces);
      expect(limit).toBe(-1);
    });

    it('effectiveMarketplaceLimit — DB null ise paket varsayılanını döner', () => {
      const limit = service.effectiveMarketplaceLimit({
        ...baseSubscription,
        marketplaceLimit: null,
        plan: PlanTier.GELISIM,
      });
      expect(limit).toBe(PLAN_LIMITS.GELISIM.marketplaces);
    });

    it('getOrgProducts — yalnızca muhasebe hattı döner', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        productLines: ['ACCOUNTING'],
      });

      const lines = await service.getOrgProducts(orgId);

      expect(lines).toEqual(['ACCOUNTING']);
    });

    it('effectiveMarketplaceLimit — DB değeri varsa onu kullanır', () => {
      const limit = service.effectiveMarketplaceLimit({
        ...baseSubscription,
        marketplaceLimit: 7,
        plan: PlanTier.GELISIM,
      });
      expect(limit).toBe(7);
    });

    it('getUsageOverview — aktif abonelikte plan limitlerini yansıtır', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...baseSubscription,
        plan: PlanTier.BASLANGIC,
        status: SubStatus.ACTIVE,
      });
      prisma.order.count.mockResolvedValue(12);
      prisma.marketplaceConnection.count.mockResolvedValue(2);
      prisma.product.count.mockResolvedValue(45);
      prisma.user.count.mockResolvedValue(1);
      prisma.warehouse.count.mockResolvedValue(1);

      const overview = await service.getUsageOverview(orgId);

      expect(overview.plan).toBe(PlanTier.BASLANGIC);
      expect(overview.orgProducts).toEqual(['INTEGRATION', 'ACCOUNTING']);
      expect(overview.usage.marketplaces.used).toBe(2);
      expect(overview.usage.marketplaces.limit).toBe(
        PLAN_LIMITS.BASLANGIC.marketplaces,
      );
      expect(overview.usage.orders.used).toBe(12);
      expect(overview.usage.orders.limit).toBe(PLAN_LIMITS.BASLANGIC.orders);
      expect(overview.usage.erpConnections.used).toBe(0);
      expect(overview.usage.erpConnections.limit).toBe(1);
    });
  });

  describe('trial süresi hesaplaması', () => {
    it('getUsageOverview — TRIAL durumunda kalan gün sayısını hesaplar', async () => {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 5);

      prisma.subscription.findUnique.mockResolvedValue({
        ...baseSubscription,
        status: SubStatus.TRIAL,
        trialEndsAt,
      });
      prisma.order.count.mockResolvedValue(0);
      prisma.marketplaceConnection.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.user.count.mockResolvedValue(1);
      prisma.warehouse.count.mockResolvedValue(0);

      const overview = await service.getUsageOverview(orgId);

      expect(overview.trialDaysLeft).toBeGreaterThanOrEqual(4);
      expect(overview.trialDaysLeft).toBeLessThanOrEqual(5);
      expect(overview.usage.products.limit).toBe(PLAN_LIMITS.GELISIM.products);
    });

    it('getUsageOverview — süresi dolmuş trial için 0 gün döner', async () => {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() - 1);

      prisma.subscription.findUnique.mockResolvedValue({
        ...baseSubscription,
        status: SubStatus.TRIAL,
        trialEndsAt,
      });
      prisma.order.count.mockResolvedValue(0);
      prisma.marketplaceConnection.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.user.count.mockResolvedValue(1);
      prisma.warehouse.count.mockResolvedValue(0);

      const overview = await service.getUsageOverview(orgId);

      expect(overview.trialDaysLeft).toBe(0);
    });
  });

  describe('addProductLine', () => {
    const actorUserId = 'user-1';

    it('ACCOUNTING hattını yalnızca entegrasyon olan orga ekler', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        id: orgId,
        productLines: ['INTEGRATION'],
      });
      prisma.organization.update.mockResolvedValue({});

      const result = await service.addProductLine(
        orgId,
        actorUserId,
        OrgProductLine.ACCOUNTING,
      );

      expect(result.productLines).toEqual(['INTEGRATION', 'ACCOUNTING']);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: orgId },
        data: { productLines: ['INTEGRATION', 'ACCOUNTING'] },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'subscription.product_line_added',
            actorUserId,
            actorOrgId: orgId,
            impersonatedOrgId: null,
            metadata: expect.objectContaining({
              productLine: OrgProductLine.ACCOUNTING,
              stub: true,
            }),
          }),
        }),
      );
    });

    it('zaten etkin hat için BadRequestException fırlatır', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        id: orgId,
        productLines: ['INTEGRATION'],
      });

      await expect(
        service.addProductLine(orgId, actorUserId, OrgProductLine.INTEGRATION),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('impersonation sırasında impersonatedOrgId audit kaydına yazılır', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        id: orgId,
        productLines: ['ACCOUNTING'],
      });
      prisma.organization.update.mockResolvedValue({});

      await service.addProductLine(
        orgId,
        actorUserId,
        OrgProductLine.INTEGRATION,
        true,
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            impersonatedOrgId: orgId,
          }),
        }),
      );
    });

    it('organizasyon yoksa NotFoundException fırlatır', async () => {
      prisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.addProductLine(orgId, actorUserId, OrgProductLine.ACCOUNTING),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('kullanım istatistikleri', () => {
    it('getUsageStats — getUsageOverview ile uyumlu özet döner', async () => {
      prisma.subscription.findUnique.mockResolvedValue(baseSubscription);
      prisma.order.count.mockResolvedValue(100);
      prisma.marketplaceConnection.count.mockResolvedValue(3);
      prisma.product.count.mockResolvedValue(200);
      prisma.user.count.mockResolvedValue(2);
      prisma.warehouse.count.mockResolvedValue(1);

      const stats = await service.getUsageStats(orgId);

      expect(stats.orders.used).toBe(100);
      expect(stats.products.used).toBe(200);
      expect(stats.users.used).toBe(2);
      expect(stats.marketplaces.used).toBe(3);
    });

    it('getUsageOverview — abonelik yoksa NotFoundException fırlatır', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.getUsageOverview(orgId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('getUsageOverview — KURUMSAL pakette limitler null (sınırsız)', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...baseSubscription,
        plan: PlanTier.KURUMSAL,
        status: SubStatus.ACTIVE,
      });
      prisma.order.count.mockResolvedValue(0);
      prisma.marketplaceConnection.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.user.count.mockResolvedValue(1);
      prisma.warehouse.count.mockResolvedValue(0);

      const overview = await service.getUsageOverview(orgId);

      expect(overview.usage.marketplaces.limit).toBeNull();
      expect(overview.usage.orders.limit).toBeNull();
      expect(overview.usage.products.limit).toBeNull();
    });
  });
});
