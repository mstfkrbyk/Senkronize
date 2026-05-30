import type { TFunction } from 'i18next';

import i18n from '@/i18n';

/** @deprecated Use t('partner.portalLabel') */
export const PARTNER_PORTAL_LABEL = 'Partner';

const PARTNER_ROUTE_KEYS: Record<string, string> = {
  '/partner': 'partner.nav.dashboard',
  '/partner/clients': 'partner.nav.clients',
  '/partner/commission': 'partner.nav.commission',
  '/partner/commission-report': 'partner.nav.commissionReport',
  '/partner/performance': 'partner.nav.performance',
  '/partner/onboarding': 'partner.nav.onboarding',
  '/partner/white-label': 'partner.nav.whiteLabel',
};

function resolveT(t?: TFunction): TFunction {
  if (t) {
    return t;
  }
  return ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { lng: 'tr', ...options })) as TFunction;
}

export function partnerPortalLabel(t?: TFunction): string {
  return resolveT(t)('partner.portalLabel');
}

export function isPartnerPortalRoute(pathname: string): boolean {
  return pathname === '/partner' || pathname.startsWith('/partner/');
}

/** Üst bağlam: «Partner» veya «Partner > Komisyon». */
export function formatPartnerNavContext(pageLabel?: string, t?: TFunction): string {
  const portal = partnerPortalLabel(t);
  if (pageLabel != null && pageLabel.length > 0) {
    return `${portal} > ${pageLabel}`;
  }
  return portal;
}

/** Alt rota sayfa etiketi; ana `/partner` için `undefined`. */
export function resolvePartnerSubPageTitle(
  pathname: string,
  t?: TFunction,
): string | undefined {
  if (pathname === '/partner' || pathname === '/partner/') {
    return undefined;
  }
  const key = PARTNER_ROUTE_KEYS[pathname];
  if (!key) {
    return undefined;
  }
  return resolveT(t)(key);
}

/** Partner org, impersonation yokken müşteri paneli mobil menüsü yerine partner kısayolları. */
export function shouldUsePartnerMobileNav(
  orgType: string | undefined,
  isImpersonating: boolean,
): boolean {
  return orgType === 'PARTNER' && !isImpersonating;
}
