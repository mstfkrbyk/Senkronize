import { PlanTier, SubStatus, type Subscription } from '@prisma/client';

export type SubscriptionPlanContext = Pick<
  Subscription,
  'plan' | 'status' | 'trialEndsAt' | 'subscriptionEndsAt' | 'currentPeriodEnd'
>;

/**
 * Panel ve limitler için efektif paket.
 * TRIAL sırasında abonelik kaydındaki plan kullanılır (admin ataması dahil).
 * Süresi dolmuş deneme / pasif abonelik → Başlangıç.
 */
export function resolveEffectivePlanTier(
  subscription: SubscriptionPlanContext | null,
  now: Date = new Date(),
): PlanTier {
  if (!subscription) {
    return PlanTier.BASLANGIC;
  }
  if (
    subscription.status === SubStatus.EXPIRED ||
    subscription.status === SubStatus.PAUSED
  ) {
    return PlanTier.BASLANGIC;
  }
  if (
    (subscription.status === SubStatus.CANCELLED ||
      subscription.status === SubStatus.CANCELING) &&
    now >
      (subscription.subscriptionEndsAt ?? subscription.currentPeriodEnd)
  ) {
    return PlanTier.BASLANGIC;
  }
  if (subscription.status === SubStatus.TRIAL) {
    if (subscription.trialEndsAt && now > subscription.trialEndsAt) {
      return PlanTier.BASLANGIC;
    }
    return subscription.plan;
  }
  return subscription.plan;
}
