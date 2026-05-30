import { PlanTier } from '@prisma/client';

import { PLATFORM_ORG_SLUG } from '../admin/admin-customer-org';
import { parseOrganizationMetadata } from './organization.types';

export function isPlatformOrganization(org: { slug: string }): boolean {
  return org.slug === PLATFORM_ORG_SLUG;
}

/** Platform veya metadata ile işaretlenmiş iç hesap — faturalandırma yok, sınırsız limit. */
export function isInternalAccount(org: {
  slug: string;
  metadata?: unknown;
}): boolean {
  if (isPlatformOrganization(org)) {
    return true;
  }
  const meta = parseOrganizationMetadata(org.metadata);
  return meta.internalAccount === true || meta.billingExempt === true;
}

export function isBillingExempt(org: {
  slug: string;
  metadata?: unknown;
}): boolean {
  return isInternalAccount(org);
}

export function mergeInternalAccountMetadata(
  metadata: unknown,
  enabled: boolean,
): Record<string, unknown> {
  const meta = parseOrganizationMetadata(metadata);
  return {
    ...meta,
    internalAccount: enabled,
    billingExempt: enabled,
  };
}

/** İç hesap için panelde gösterilecek paket (DB plan alanı). */
export function internalAccountDisplayPlan(
  subscriptionPlan: PlanTier | undefined,
): PlanTier {
  return subscriptionPlan ?? PlanTier.KURUMSAL;
}
