import { describe, expect, it } from 'vitest';

import '@/i18n';
import { adminAccountingModeLabel } from '@/lib/admin-i18n-labels';
import {
  adminOrgsToCsv,
  getAdminOrgsCsvHeaders,
} from '@/pages/admin/admin-orgs-csv';
import type { AdminOrganizationRow } from '@/types/admin';

function minimalOrg(overrides: Partial<AdminOrganizationRow> = {}): AdminOrganizationRow {
  return {
    id: 'org-1',
    name: 'Test Org',
    slug: 'test-org',
    taxNumber: null,
    suspended: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    subscription: null,
    _count: { users: 0, marketplaceConnections: 0, orders: 0 },
    lastActivityAt: null,
    orgProducts: ['ACCOUNTING'],
    accountingMode: 'NATIVE',
    activePartners: [],
    ...overrides,
  };
}

describe('adminOrgsToCsv', () => {
  it('includes Muhasebe modu column with resolved labels', () => {
    const csv = adminOrgsToCsv([
      minimalOrg({ accountingMode: 'NATIVE' }),
      minimalOrg({
        id: 'org-2',
        name: 'ERP Org',
        accountingMode: 'EXTERNAL_ERP',
      }),
    ]);

    const headers = getAdminOrgsCsvHeaders();
    expect(headers).toContain('Muhasebe modu');
    expect(csv.split('\n')[0]).toContain('Muhasebe modu');
    expect(csv).toContain(adminAccountingModeLabel('NATIVE'));
    expect(csv).toContain(adminAccountingModeLabel('EXTERNAL_ERP'));
  });
});
