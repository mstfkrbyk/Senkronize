import { PlanTier, SubStatus, type Subscription } from '@prisma/client';

import { resolveEffectivePlanTier } from './subscription-effective-plan';

function sub(
  partial: Partial<Subscription> & Pick<Subscription, 'plan' | 'status'>,
): Subscription {
  return {
    id: 'sub-1',
    organizationId: 'org-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    billingPeriod: 'MONTHLY',
    monthlyOrderLimit: 100,
    marketplaceLimit: 1,
    ecommerceLimit: 0,
    erpLimit: 0,
    userLimit: 2,
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2026-02-01'),
    subscriptionEndsAt: null,
    canceledAt: null,
    trialEndsAt: new Date('2026-12-31'),
    paytrToken: null,
    iyzicoCustomerRef: null,
    ...partial,
  } as Subscription;
}

describe('resolveEffectivePlanTier', () => {
  it('TRIAL + KURUMSAL plan → KURUMSAL (admin ataması)', () => {
    expect(
      resolveEffectivePlanTier(
        sub({ status: SubStatus.TRIAL, plan: PlanTier.KURUMSAL }),
        new Date('2026-06-01'),
      ),
    ).toBe(PlanTier.KURUMSAL);
  });

  it('TRIAL süresi dolmuş → BASLANGIC', () => {
    expect(
      resolveEffectivePlanTier(
        sub({
          status: SubStatus.TRIAL,
          plan: PlanTier.KURUMSAL,
          trialEndsAt: new Date('2026-01-01'),
        }),
        new Date('2026-06-01'),
      ),
    ).toBe(PlanTier.BASLANGIC);
  });

  it('ACTIVE + PRO → PRO', () => {
    expect(
      resolveEffectivePlanTier(
        sub({ status: SubStatus.ACTIVE, plan: PlanTier.PRO }),
      ),
    ).toBe(PlanTier.PRO);
  });
});
