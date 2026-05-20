import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Marketplace, PlanTier, SubStatus } from '@prisma/client';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { PostHogService } from '../analytics/posthog.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

import type { CreateConnectionDto } from './marketplace-connection.dto';
import { MarketplaceConnectionService } from './marketplace-connection.service';

describe('MarketplaceConnectionService', () => {
  let service: MarketplaceConnectionService;
  let prisma: {
    marketplaceConnection: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    subscription: { findUnique: jest.Mock };
  };
  let encryptionService: { encrypt: jest.Mock; decrypt: jest.Mock };
  let subscriptionService: { effectiveMarketplaceLimit: jest.Mock };

  const orgId = 'org-1';

  const baseRow = {
    id: 'mc-1',
    organizationId: orgId,
    platform: Marketplace.TRENDYOL,
    credentialsEnc: 'enc',
    isActive: true,
    lastSyncAt: null,
    lastSyncMeta: null,
    syncErrorCount: 0,
    lastErrorAt: null,
    lastErrorMessage: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    webhookSecret: null,
  };

  beforeEach(async () => {
    prisma = {
      marketplaceConnection: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      subscription: { findUnique: jest.fn() },
    };

    encryptionService = {
      encrypt: jest.fn().mockReturnValue('encrypted-blob'),
      decrypt: jest.fn().mockReturnValue('{}'),
    };

    subscriptionService = {
      effectiveMarketplaceLimit: jest.fn().mockReturnValue(5),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceConnectionService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryptionService },
        {
          provide: AdapterRegistry,
          useValue: { get: jest.fn() },
        },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: PostHogService, useValue: { capture: jest.fn(), groupCapture: jest.fn() } },
      ],
    }).compile();

    service = module.get(MarketplaceConnectionService);
  });

  it('bağlantı eklemede abonelik limiti kontrolü çalışır', async () => {
    prisma.marketplaceConnection.findFirst.mockResolvedValue(null);
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      organizationId: orgId,
      plan: PlanTier.GELISIM,
      marketplaceLimit: 3,
      status: SubStatus.ACTIVE,
    });
    subscriptionService.effectiveMarketplaceLimit.mockReturnValue(3);
    prisma.marketplaceConnection.count.mockResolvedValue(1);
    prisma.marketplaceConnection.create.mockResolvedValue(baseRow);

    const dto: CreateConnectionDto = {
      platform: Marketplace.TRENDYOL,
      credentials: { apiKey: 'k', apiSecret: 's' },
    };

    await service.create(orgId, dto);

    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { organizationId: orgId },
    });
    expect(prisma.marketplaceConnection.count).toHaveBeenCalledWith({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
    });
    expect(subscriptionService.effectiveMarketplaceLimit).toHaveBeenCalled();
  });

  it('limit aşılınca 402 HttpException', async () => {
    prisma.marketplaceConnection.findFirst.mockResolvedValue(null);
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      organizationId: orgId,
      plan: PlanTier.BASLANGIC,
      marketplaceLimit: 1,
      status: SubStatus.ACTIVE,
    });
    subscriptionService.effectiveMarketplaceLimit.mockReturnValue(1);
    prisma.marketplaceConnection.count.mockResolvedValue(1);

    const dto: CreateConnectionDto = {
      platform: Marketplace.N11,
      credentials: { apiKey: 'k' },
    };

    try {
      await service.create(orgId, dto);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
    }
    expect(prisma.marketplaceConnection.create).not.toHaveBeenCalled();
  });

  it('getActiveConnections yalnızca aktif bağlantıları döndürür', async () => {
    prisma.marketplaceConnection.findMany.mockResolvedValue([
      { ...baseRow, id: 'a', isActive: true },
    ]);

    const list = await service.getActiveConnections(orgId);

    expect(prisma.marketplaceConnection.findMany).toHaveBeenCalledWith({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('a');
  });

  it('create sırasında credential şifreleme encrypt çağırır', async () => {
    prisma.marketplaceConnection.findFirst.mockResolvedValue(null);
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      organizationId: orgId,
      plan: PlanTier.PRO,
      marketplaceLimit: 10,
      status: SubStatus.ACTIVE,
    });
    subscriptionService.effectiveMarketplaceLimit.mockReturnValue(10);
    prisma.marketplaceConnection.count.mockResolvedValue(0);
    prisma.marketplaceConnection.create.mockResolvedValue(baseRow);

    const creds = { sellerId: '99', token: 't' };
    const dto: CreateConnectionDto = {
      platform: Marketplace.TRENDYOL,
      credentials: creds,
    };

    await service.create(orgId, dto);

    expect(encryptionService.encrypt).toHaveBeenCalledWith(
      JSON.stringify(creds),
    );
  });
});
