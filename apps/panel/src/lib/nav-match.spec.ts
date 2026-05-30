import { describe, expect, it } from 'vitest';

import {
  buildEcommerceNavItems,
  buildExternalErpNavItems,
  buildNativeAccountingNavItems,
  buildVisibleNavCatalog,
  flattenNavCatalog,
  shouldPlaceStockInEcommerce,
  shouldPlaceStockInNativeAccounting,
  type NavCatalogContext,
} from './nav-match';

/** `prisma/seed.ts` → `demo-external-erp` (BUNDLE + EXTERNAL_ERP). */
const DEMO_EXTERNAL_ERP_PRODUCTS = [
  'INTEGRATION',
  'ACCOUNTING',
] as const satisfies NavCatalogContext['orgProducts'];

const demoExternalErpCtx: NavCatalogContext = {
  orgProducts: [...DEMO_EXTERNAL_ERP_PRODUCTS],
  accountingMode: 'EXTERNAL_ERP',
};

const bundleNativeCtx: NavCatalogContext = {
  orgProducts: [...DEMO_EXTERNAL_ERP_PRODUCTS],
  accountingMode: 'NATIVE',
};

function navPaths(items: ReturnType<typeof buildVisibleNavCatalog>): string[] {
  return flattenNavCatalog(items).map((item) => item.path);
}

describe('demo-external-erp (BUNDLE + EXTERNAL_ERP)', () => {
  it('hides ops-only sync nav for regular users', () => {
    const external = buildExternalErpNavItems(demoExternalErpCtx);
    const paths = external.map((item) => item.path);
    expect(paths).toContain('/connections');
    expect(paths).not.toContain('/sync-logs');
    expect(paths).not.toContain('/sync/history');
  });

  it('shows ops-only sync nav for SUPER_ADMIN', () => {
    const external = buildExternalErpNavItems({
      ...demoExternalErpCtx,
      canViewIntegrationOps: true,
    });
    const paths = external.map((item) => item.path);
    expect(paths).toContain('/sync-logs');
    expect(paths).toContain('/sync/history');
  });
  it('stok e-ticaret grubunda, ön muhasebe grubunda değil', () => {
    expect(shouldPlaceStockInEcommerce(demoExternalErpCtx)).toBe(true);
    expect(shouldPlaceStockInNativeAccounting(demoExternalErpCtx)).toBe(false);
  });

  it('yerel ön muhasebe menüsü gizli, harici ERP menüsü görünür', () => {
    expect(buildNativeAccountingNavItems(demoExternalErpCtx)).toEqual([]);
    const external = buildExternalErpNavItems(demoExternalErpCtx);
    expect(external.length).toBeGreaterThan(0);
    expect(
      external.some(
        (item) => item.path === '/connections' && item.labelKey === 'nav.integrations',
      ),
    ).toBe(true);
    expect(
      external.some((item) => item.path === '/connections' && item.search === '?tab=erp'),
    ).toBe(false);
  });

  it('e-ticaret menüsünde ayrı stok menüsü yok; ürünler var', () => {
    const ecommerce = buildEcommerceNavItems(demoExternalErpCtx);
    const paths = navPaths(ecommerce);
    expect(paths).toContain('/products');
    expect(paths).not.toContain('/stock');
    expect(paths).not.toContain('/sync-logs');
    expect(paths).not.toContain('/sync/history');
    expect(paths).not.toContain('/accounting');
  });

  it('görünür katalogda harici ERP ve e-ticaret bölümleri birlikte', () => {
    const catalog = buildVisibleNavCatalog(demoExternalErpCtx);
    const groups = new Set(
      flattenNavCatalog(catalog).map((item) => item.group).filter(Boolean),
    );
    expect(groups.has('ecommerce')).toBe(true);
    expect(groups.has('externalErp')).toBe(true);
    expect(groups.has('nativeAccounting')).toBe(false);
  });
});

describe('BUNDLE accounting mode contrast', () => {
  it('NATIVE: stok ürünler sekmesinde, harici ERP menüsü yok', () => {
    expect(shouldPlaceStockInNativeAccounting(bundleNativeCtx)).toBe(true);
    expect(shouldPlaceStockInEcommerce(bundleNativeCtx)).toBe(false);
    expect(buildExternalErpNavItems(bundleNativeCtx)).toEqual([]);
    const native = buildNativeAccountingNavItems(bundleNativeCtx);
    expect(navPaths(native)).not.toContain('/stock');
    const ecommerce = buildEcommerceNavItems(bundleNativeCtx);
    expect(navPaths(ecommerce)).toContain('/products');
  });

  it('EXTERNAL_ERP: stok ayrı menüde değil; ürünler e-ticarette', () => {
    expect(shouldPlaceStockInNativeAccounting(demoExternalErpCtx)).toBe(false);
    expect(buildNativeAccountingNavItems(demoExternalErpCtx)).toEqual([]);
    const ecommerce = buildEcommerceNavItems(demoExternalErpCtx);
    expect(navPaths(ecommerce)).toContain('/products');
    expect(navPaths(ecommerce)).not.toContain('/stock');
  });
});
