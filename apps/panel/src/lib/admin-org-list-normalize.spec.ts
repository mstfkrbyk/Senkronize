import { describe, expect, it } from 'vitest';

import {
  formatAdminAccountingModeLabel,
  normalizeAdminOrganizationRow,
} from '@/lib/admin-org-list-normalize';
import type { AdminOrganizationRow } from '@/types/admin';

function minimalOrg(overrides: Partial<AdminOrganizationRow> = {}): AdminOrganizationRow {
  return {
    id: 'org-1',
    name: 'Test',
    slug: 'test',
    taxNumber: null,
    suspended: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    subscription: null,
    _count: { users: 1, marketplaceConnections: 0, orders: 2 },
    lastActivityAt: null,
    orgProducts: ['INTEGRATION'],
    accountingMode: 'NATIVE',
    activePartners: [],
    ...overrides,
  };
}

describe('normalizeAdminOrganizationRow', () => {
  it('fills missing activePartners and _count', () => {
    const raw = minimalOrg({
      activePartners: undefined as unknown as AdminOrganizationRow['activePartners'],
      _count: undefined as unknown as AdminOrganizationRow['_count'],
    });
    const row = normalizeAdminOrganizationRow(raw);
    expect(row.activePartners).toEqual([]);
    expect(row._count.orders).toBe(0);
  });

  it('defaults invalid accountingMode to NATIVE label', () => {
    const row = normalizeAdminOrganizationRow(
      minimalOrg({ accountingMode: null as unknown as 'NATIVE' }),
    );
    expect(formatAdminAccountingModeLabel(row.accountingMode)).toBe('Ön muhasebe');
  });
});
