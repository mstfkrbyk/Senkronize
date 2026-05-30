import { describe, expect, it } from 'vitest';

import '@/i18n';
import {
  adminAccountingModeLabel,
  adminPlanTierLabel,
} from '@/lib/admin-i18n-labels';
import {
  adminPartnerClientsToCsv,
  getAdminPartnerClientsCsvHeaders,
} from '@/pages/admin/admin-partner-clients-csv';
import type { AdminOrganizationRow } from '@/types/admin';

function minimalOrg(overrides: Partial<AdminOrganizationRow> = {}): AdminOrganizationRow {
  return {
    id: 'org-1',
    name: 'Test Org',
    slug: 'test-org',
    taxNumber: null,
    suspended: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    subscription: { plan: 'PRO', status: 'TRIAL', trialEndsAt: null },
    _count: { users: 0, marketplaceConnections: 0, orders: 0 },
    lastActivityAt: null,
    orgProducts: ['INTEGRATION', 'ACCOUNTING'],
    accountingMode: 'NATIVE',
    activePartners: [],
    ...overrides,
  };
}

describe('adminPartnerClientsToCsv', () => {
  it('uses i18n headers and resolved admin labels', () => {
    const headers = getAdminPartnerClientsCsvHeaders();
    const csv = adminPartnerClientsToCsv([minimalOrg(), minimalOrg({ accountingMode: 'EXTERNAL_ERP' })]);

    expect(headers).toContain('Muhasebe');
    expect(csv.split('\n')[0]).toContain('Muhasebe');
    expect(csv).toContain(adminAccountingModeLabel('NATIVE'));
    expect(csv).toContain(adminAccountingModeLabel('EXTERNAL_ERP'));
    expect(csv).toContain(adminPlanTierLabel('PRO'));
    expect(csv).toContain('test-org');
  });
});
