import { describe, expect, it } from 'vitest';

import type { ConnectionsProductAccess } from '@/pages/connections/connections-product-access';

import { resolveSyncLogsNavGroupId } from './sync-logs-nav-context';

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

describe('resolveSyncLogsNavGroupId', () => {
  it('EXTERNAL_ERP + yalnız muhasebe → externalErp', () => {
    expect(
      resolveSyncLogsNavGroupId(accountingOnly, 'EXTERNAL_ERP', 'channel'),
    ).toBe('externalErp');
  });

  it('BUNDLE + EXTERNAL_ERP + kanal sekmesi → externalErp', () => {
    expect(resolveSyncLogsNavGroupId(bundle, 'EXTERNAL_ERP', 'channel')).toBe(
      'externalErp',
    );
  });

  it('BUNDLE + EXTERNAL_ERP + ERP sekmesi → externalErp', () => {
    expect(resolveSyncLogsNavGroupId(bundle, 'EXTERNAL_ERP', 'erp')).toBe(
      'externalErp',
    );
  });

  it('entegrasyon hattı + NATIVE + kanal → ecommerce', () => {
    expect(
      resolveSyncLogsNavGroupId(integrationOnly, 'NATIVE', 'channel'),
    ).toBe('ecommerce');
  });
});
