import { describe, expect, it } from 'vitest';

import type { ConnectionsProductAccess } from './connections-product-access';
import { resolveConnectionsNavGroupId } from './connections-nav-context';

const integrationOnly: ConnectionsProductAccess = {
  hasIntegration: true,
  hasAccounting: false,
  accountingOnly: false,
  integrationOnly: true,
  showIntegrationTabs: true,
  showErpBridge: true,
};

const bundle: ConnectionsProductAccess = {
  hasIntegration: true,
  hasAccounting: true,
  accountingOnly: false,
  integrationOnly: false,
  showIntegrationTabs: true,
  showErpBridge: true,
};

const accountingOnly: ConnectionsProductAccess = {
  hasIntegration: false,
  hasAccounting: true,
  accountingOnly: true,
  integrationOnly: false,
  showIntegrationTabs: false,
  showErpBridge: true,
};

describe('resolveConnectionsNavGroupId', () => {
  it('EXTERNAL_ERP + yalnız muhasebe → externalErp', () => {
    expect(
      resolveConnectionsNavGroupId(
        accountingOnly,
        'EXTERNAL_ERP',
        'marketplace',
        null,
      ),
    ).toBe('externalErp');
  });

  it('BUNDLE + EXTERNAL_ERP + kanal sekmesi → ecommerce', () => {
    expect(
      resolveConnectionsNavGroupId(bundle, 'EXTERNAL_ERP', 'marketplace', null),
    ).toBe('ecommerce');
  });

  it('BUNDLE + EXTERNAL_ERP + e-ticaret sekmesi → ecommerce', () => {
    expect(
      resolveConnectionsNavGroupId(bundle, 'EXTERNAL_ERP', 'ecommerce', null),
    ).toBe('ecommerce');
  });

  it('BUNDLE + EXTERNAL_ERP + ?tab=erp → externalErp', () => {
    expect(
      resolveConnectionsNavGroupId(
        bundle,
        'EXTERNAL_ERP',
        'marketplace',
        'erp',
      ),
    ).toBe('externalErp');
  });

  it('BUNDLE + EXTERNAL_ERP + erp sekmesi → externalErp', () => {
    expect(
      resolveConnectionsNavGroupId(bundle, 'EXTERNAL_ERP', 'erp', null),
    ).toBe('externalErp');
  });

  it('entegrasyon hattı + NATIVE + kanal → ecommerce', () => {
    expect(
      resolveConnectionsNavGroupId(
        integrationOnly,
        'NATIVE',
        'ecommerce',
        null,
      ),
    ).toBe('ecommerce');
  });
});
