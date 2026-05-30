import { describe, expect, it } from 'vitest';

import type { OrgProductLine } from '@/types/auth';

import {
  isBundleOrg,
  resolveOrgHomePath,
  resolveProductLineDenyPath,
  resolveStockRouteProductLine,
} from './org-products';

/** `prisma/seed.ts` → `demo-external-erp` (productLines: BUNDLE, accountingMode: EXTERNAL_ERP). */
const DEMO_EXTERNAL_ERP_PRODUCTS: OrgProductLine[] = [
  'INTEGRATION',
  'ACCOUNTING',
];

describe('resolveOrgHomePath', () => {
  it('PARTNER org → /partner', () => {
    expect(
      resolveOrgHomePath(['INTEGRATION', 'ACCOUNTING'], 'PARTNER', 'NATIVE'),
    ).toBe('/partner');
  });

  it('yalnız ACCOUNTING → /accounting', () => {
    expect(resolveOrgHomePath(['ACCOUNTING'], undefined, 'NATIVE')).toBe(
      '/accounting',
    );
    expect(resolveOrgHomePath(['ACCOUNTING'], undefined, 'EXTERNAL_ERP')).toBe(
      '/accounting',
    );
  });

  it('yalnız INTEGRATION → /dashboard', () => {
    expect(resolveOrgHomePath(['INTEGRATION'], undefined, 'NATIVE')).toBe(
      '/dashboard',
    );
  });

  it('BUNDLE + NATIVE → /accounting', () => {
    expect(
      resolveOrgHomePath(['INTEGRATION', 'ACCOUNTING'], undefined, 'NATIVE'),
    ).toBe('/accounting');
  });

  it('BUNDLE + EXTERNAL_ERP → /dashboard', () => {
    expect(
      resolveOrgHomePath(
        ['INTEGRATION', 'ACCOUNTING'],
        undefined,
        'EXTERNAL_ERP',
      ),
    ).toBe('/dashboard');
  });

  it('BUNDLE mod belirtilmemiş → /accounting (NATIVE varsayılanı)', () => {
    expect(resolveOrgHomePath(['INTEGRATION', 'ACCOUNTING'])).toBe(
      '/accounting',
    );
  });

  it('demo-external-erp → /dashboard', () => {
    expect(
      resolveOrgHomePath(DEMO_EXTERNAL_ERP_PRODUCTS, undefined, 'EXTERNAL_ERP'),
    ).toBe('/dashboard');
  });
});

describe('demo-external-erp (BUNDLE + EXTERNAL_ERP)', () => {
  it('isBundleOrg', () => {
    expect(isBundleOrg(DEMO_EXTERNAL_ERP_PRODUCTS)).toBe(true);
  });

  it('resolveStockRouteProductLine → INTEGRATION (pazaryeri stoku)', () => {
    expect(
      resolveStockRouteProductLine(DEMO_EXTERNAL_ERP_PRODUCTS, 'EXTERNAL_ERP'),
    ).toBe('INTEGRATION');
  });

  it('/stock reddi: ACCOUNTING → /dashboard', () => {
    expect(
      resolveProductLineDenyPath('ACCOUNTING', {
        pathname: '/stock',
        orgProducts: DEMO_EXTERNAL_ERP_PRODUCTS,
        accountingMode: 'EXTERNAL_ERP',
      }),
    ).toBe('/dashboard');
  });

  it('/stock reddi: INTEGRATION → /accounting', () => {
    expect(
      resolveProductLineDenyPath('INTEGRATION', {
        pathname: '/stock',
        orgProducts: DEMO_EXTERNAL_ERP_PRODUCTS,
        accountingMode: 'EXTERNAL_ERP',
      }),
    ).toBe('/accounting');
  });
});

describe('BUNDLE stock route contrast', () => {
  const bundle = DEMO_EXTERNAL_ERP_PRODUCTS;

  it('NATIVE → yerel envanter (ACCOUNTING)', () => {
    expect(resolveStockRouteProductLine(bundle, 'NATIVE')).toBe('ACCOUNTING');
  });

  it('EXTERNAL_ERP → pazaryeri stoku (INTEGRATION)', () => {
    expect(resolveStockRouteProductLine(bundle, 'EXTERNAL_ERP')).toBe(
      'INTEGRATION',
    );
  });
});
