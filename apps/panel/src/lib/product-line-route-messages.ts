import {
  isStockPath,
  resolveStockRouteProductLine,
  type ProductLineDenyPathContext,
} from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

/** i18n keys under default `translation` namespace */
export interface ProductLineRouteMessageKeys {
  feature: string;
  description: string;
  /** `fallback: 'redirect'` — erişim reddedilince hedef sayfa bildirimi */
  redirectToast: string;
  cta: string;
}

/** Ortak yükseltme CTA — bağlantılar ve rota koruması */
export const PRODUCT_LINE_ROUTE_CTA_KEY = 'productLineRoute.cta';

const STOCK_ACCOUNTING_REDIRECT_TOAST_KEY =
  'productLineRoute.stock.accounting.redirectToast';
const STOCK_INTEGRATION_REDIRECT_TOAST_KEY =
  'productLineRoute.stock.integration.redirectToast';
const STOCK_INTEGRATION_EXTERNAL_ERP_REDIRECT_TOAST_KEY =
  'productLineRoute.stock.integrationExternalErp.redirectToast';

const KEYS: Record<OrgProductLine, ProductLineRouteMessageKeys> = {
  INTEGRATION: {
    feature: 'productLineRoute.integration.feature',
    description: 'productLineRoute.integration.description',
    redirectToast: 'productLineRoute.integration.redirectToast',
    cta: PRODUCT_LINE_ROUTE_CTA_KEY,
  },
  ACCOUNTING: {
    feature: 'productLineRoute.accounting.feature',
    description: 'productLineRoute.accounting.description',
    redirectToast: 'productLineRoute.accounting.redirectToast',
    cta: PRODUCT_LINE_ROUTE_CTA_KEY,
  },
};

export function productLineRouteMessageKeys(
  required: OrgProductLine,
): ProductLineRouteMessageKeys {
  return KEYS[required];
}

/**
 * Stok rotasında reddedilen hat, `resolveStockRouteProductLine` ile aynıysa
 * muhasebe moduna göre net Türkçe toast anahtarı döner.
 */
export function resolveProductLineRedirectToastKey(
  required: OrgProductLine,
  ctx?: ProductLineDenyPathContext,
): string {
  const base = productLineRouteMessageKeys(required).redirectToast;
  if (
    !ctx?.pathname ||
    !isStockPath(ctx.pathname) ||
    !ctx.orgProducts?.length ||
    !ctx.accountingMode
  ) {
    return base;
  }

  const stockLine = resolveStockRouteProductLine(
    ctx.orgProducts,
    ctx.accountingMode,
  );
  if (required !== stockLine) {
    return base;
  }

  if (stockLine === 'ACCOUNTING') {
    return STOCK_ACCOUNTING_REDIRECT_TOAST_KEY;
  }
  return ctx.accountingMode === 'EXTERNAL_ERP'
    ? STOCK_INTEGRATION_EXTERNAL_ERP_REDIRECT_TOAST_KEY
    : STOCK_INTEGRATION_REDIRECT_TOAST_KEY;
}
