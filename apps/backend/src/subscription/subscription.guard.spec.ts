import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PlanTier, SubStatus } from '@prisma/client';

import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PrismaService } from '../prisma/prisma.service';

function mockHttpContext(orgId: string): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { currentOrgId: orgId } }),
    }),
  } as unknown as ExecutionContext;
}

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let prisma: { subscription: { findUnique: jest.Mock } };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    prisma = {
      subscription: { findUnique: jest.fn() },
    };
    reflector = { getAllAndOverride: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(SubscriptionGuard);
  });

  it('BASLANGIC planı GELISIM gerektiren endpointte 402', async () => {
    reflector.getAllAndOverride.mockReturnValue(PlanTier.GELISIM);
    prisma.subscription.findUnique.mockResolvedValue({
      organizationId: 'org-1',
      plan: PlanTier.BASLANGIC,
      status: SubStatus.ACTIVE,
      trialEndsAt: null,
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });

    try {
      await guard.canActivate(mockHttpContext('org-1'));
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
    }
  });

  it('PRO planı PRO gerektiren endpointte geçer', async () => {
    reflector.getAllAndOverride.mockReturnValue(PlanTier.PRO);
    prisma.subscription.findUnique.mockResolvedValue({
      organizationId: 'org-2',
      plan: PlanTier.PRO,
      status: SubStatus.ACTIVE,
      trialEndsAt: null,
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });

    await expect(guard.canActivate(mockHttpContext('org-2'))).resolves.toBe(
      true,
    );
  });

  it('KURUMSAL plan tüm tier gereksinimlerinde geçer', async () => {
    reflector.getAllAndOverride.mockReturnValue(PlanTier.PRO);
    prisma.subscription.findUnique.mockResolvedValue({
      organizationId: 'org-3',
      plan: PlanTier.KURUMSAL,
      status: SubStatus.ACTIVE,
      trialEndsAt: null,
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });

    await expect(guard.canActivate(mockHttpContext('org-3'))).resolves.toBe(
      true,
    );
  });
});
