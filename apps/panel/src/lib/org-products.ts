import type { AccountingMode } from '@/types/auth';
import type { OrgProductLine, OrgType } from '@/types/auth';

const DEFAULT_LINES: OrgProductLine[] = ['INTEGRATION', 'ACCOUNTING'];

export function hasOrgProductLine(
  orgProducts: OrgProductLine[] | undefined,
  line: OrgProductLine,
): boolean {
  const lines = orgProducts?.length ? orgProducts : DEFAULT_LINES;
  return lines.includes(line);
}

/** Entegrasyon + ön muhasebe (BUNDLE). */
export function isBundleOrg(
  orgProducts: OrgProductLine[] | undefined,
): boolean {
  return (
    hasOrgProductLine(orgProducts, 'INTEGRATION') &&
    hasOrgProductLine(orgProducts, 'ACCOUNTING')
  );
}

/** Yalnızca ön muhasebe hattı (entegrasyon yok). */
export function isAccountingOnlyOrg(
  orgProducts: OrgProductLine[] | undefined,
): boolean {
  return (
    hasOrgProductLine(orgProducts, 'ACCOUNTING') &&
    !hasOrgProductLine(orgProducts, 'INTEGRATION')
  );
}

/** Yalnızca entegrasyon hattı (ön muhasebe yok). */
export function isIntegrationOnlyOrg(
  orgProducts: OrgProductLine[] | undefined,
): boolean {
  return (
    hasOrgProductLine(orgProducts, 'INTEGRATION') &&
    !hasOrgProductLine(orgProducts, 'ACCOUNTING')
  );
}

export function isStockPath(pathname: string): boolean {
  if (pathname === '/stock' || pathname.startsWith('/stock/')) {
    return true;
  }
  if (pathname === '/products/count' || pathname.startsWith('/products/count/')) {
    return true;
  }
  if (pathname.startsWith('/products/transfers')) {
    return true;
  }
  return false;
}

export function isProductsStockTab(search: string): boolean {
  const tab = new URLSearchParams(search).get('tab');
  return tab !== null && tab !== 'catalog';
}

/**
 * `/stock` rotaları için gerekli ürün hattı.
 * Yerel envanter (NATIVE / yalnızca muhasebe) → ACCOUNTING; pazaryeri stoku → INTEGRATION.
 */
export function resolveStockRouteProductLine(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): OrgProductLine {
  if (isAccountingOnlyOrg(orgProducts)) {
    return 'ACCOUNTING';
  }
  if (isIntegrationOnlyOrg(orgProducts)) {
    return 'INTEGRATION';
  }
  if (
    hasOrgProductLine(orgProducts, 'ACCOUNTING') &&
    accountingMode === 'NATIVE'
  ) {
    return 'ACCOUNTING';
  }
  return 'INTEGRATION';
}

export interface ProductLineDenyPathContext {
  pathname?: string;
  orgProducts?: OrgProductLine[];
  accountingMode?: AccountingMode;
}

/**
 * Ürün hattı eksikken yönlendirme hedefi.
 * - Entegrasyon yok → ön muhasebe özeti (`/accounting`)
 * - Ön muhasebe yok → kontrol paneli (`/dashboard`)
 * - Stok rotasında reddedilen hat, stok için gerekli hat ile aynıysa karşı hat ana sayfası
 */
export function resolveProductLineDenyPath(
  required: OrgProductLine,
  ctx?: ProductLineDenyPathContext,
): '/dashboard' | '/accounting' {
  if (
    ctx?.pathname &&
    isStockPath(ctx.pathname) &&
    ctx.orgProducts &&
    ctx.accountingMode
  ) {
    const stockLine = resolveStockRouteProductLine(
      ctx.orgProducts,
      ctx.accountingMode,
    );
    if (required === stockLine) {
      return stockLine === 'INTEGRATION' ? '/accounting' : '/dashboard';
    }
  }
  return required === 'INTEGRATION' ? '/accounting' : '/dashboard';
}

/** `/` ve giriş sonrası varsayılan hedef. */
export function resolveOrgHomePath(
  orgProducts: OrgProductLine[] | undefined,
  orgType?: OrgType,
  accountingMode?: AccountingMode,
): '/dashboard' | '/accounting' | '/partner' {
  if (orgType === 'PARTNER') {
    return '/partner';
  }
  if (isAccountingOnlyOrg(orgProducts)) {
    return '/accounting';
  }
  if (isIntegrationOnlyOrg(orgProducts)) {
    return '/dashboard';
  }
  if (isBundleOrg(orgProducts)) {
    return accountingMode === 'EXTERNAL_ERP' ? '/dashboard' : '/accounting';
  }
  return '/dashboard';
}
