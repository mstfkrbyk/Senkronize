import { describe, expect, it } from 'vitest';

import {
  asArray,
  formatAdminHealthErrorRate,
  normalizeAdminCohortData,
  normalizeAdminHealthStats,
  normalizeAdminOrgListResponse,
  normalizeAdminOrganizationDetail,
  normalizeAdminPlatformStats,
  normalizeAdminUsersListResponse,
} from '@/lib/admin-api-normalize';
import type { AdminOrganizationRow } from '@/types/admin';

function minimalOrg(): AdminOrganizationRow {
  return {
    id: 'org-1',
    name: 'Test',
    slug: 'test',
    taxNumber: null,
    suspended: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    subscription: null,
    _count: { users: 0, marketplaceConnections: 0, orders: 0 },
    lastActivityAt: null,
    orgProducts: ['INTEGRATION'],
    accountingMode: 'NATIVE',
    activePartners: [],
  };
}

describe('asArray', () => {
  it('returns empty array for null and non-arrays', () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
    expect(asArray({})).toEqual([]);
  });

  it('returns the same array reference for arrays', () => {
    const arr = [1, 2];
    expect(asArray(arr)).toBe(arr);
  });
});

describe('normalizeAdminOrgListResponse', () => {
  it('returns empty orgs when orgs missing', () => {
    const result = normalizeAdminOrgListResponse({ total: 0, page: 1, limit: 20 });
    expect(result.orgs).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns empty orgs when orgs is null', () => {
    const result = normalizeAdminOrgListResponse({
      orgs: null as unknown as AdminOrganizationRow[],
      total: 5,
      page: 2,
      limit: 10,
    });
    expect(result.orgs).toEqual([]);
    expect(result.total).toBe(5);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('returns empty orgs when orgs is undefined', () => {
    const result = normalizeAdminOrgListResponse({
      orgs: undefined,
      total: 0,
    });
    expect(result.orgs).toEqual([]);
  });

  it('returns empty orgs for null/undefined payload', () => {
    expect(normalizeAdminOrgListResponse(null).orgs).toEqual([]);
    expect(normalizeAdminOrgListResponse(undefined).orgs).toEqual([]);
  });

  it('normalizes org rows', () => {
    const result = normalizeAdminOrgListResponse({
      orgs: [minimalOrg()],
      total: 1,
      page: 1,
      limit: 20,
    });
    expect(result.orgs).toHaveLength(1);
    expect(result.orgs[0]!.activePartners).toEqual([]);
  });

  it('fills defaults on partial org rows', () => {
    const partial = {
      id: 'org-partial',
      name: 'Kısmi',
      slug: 'kisimi',
    } as AdminOrganizationRow;

    const result = normalizeAdminOrgListResponse({ orgs: [partial] });
    const row = result.orgs[0]!;

    expect(row.activePartners).toEqual([]);
    expect(row._count).toEqual({
      users: 0,
      marketplaceConnections: 0,
      orders: 0,
    });
    expect(row.accountingMode).toBe('NATIVE');
    expect(row.orgProducts).toEqual(['INTEGRATION', 'ACCOUNTING']);
  });
});

describe('normalizeAdminUsersListResponse', () => {
  it('returns empty users when users missing', () => {
    expect(normalizeAdminUsersListResponse(null).users).toEqual([]);
  });
});

describe('normalizeAdminOrganizationDetail', () => {
  it('ensures list fields are arrays', () => {
    const detail = normalizeAdminOrganizationDetail({
      organization: {
        id: 'o1',
        slug: 's',
        name: 'N',
        taxNumber: null,
        taxOffice: null,
        address: null,
        city: null,
        website: null,
        type: 'DIRECT',
        suspended: false,
        onboardingCompleted: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      users: null as unknown as [],
      marketplaceConnections: undefined,
      recentOrders: null as unknown as [],
      recentAuditLogs: undefined,
      payments: null as unknown as [],
      activePartners: undefined,
    });
    expect(detail.users).toEqual([]);
    expect(detail.marketplaceConnections).toEqual([]);
    expect(detail.recentOrders).toEqual([]);
    expect(detail.recentAuditLogs).toEqual([]);
    expect(detail.payments).toEqual([]);
    expect(detail.activePartners).toEqual([]);
  });
});

describe('normalizeAdminCohortData', () => {
  it('fills missing retention with empty array', () => {
    const rows = normalizeAdminCohortData([
      { cohortMonth: '2026-01', cohortSize: 10 },
    ]);
    expect(rows[0]!.retention).toEqual([]);
  });
});

describe('normalizeAdminPlatformStats', () => {
  it('ensures distribution arrays exist', () => {
    const stats = normalizeAdminPlatformStats({});
    expect(stats.planDistribution).toEqual([]);
    expect(stats.dailyNewRegistrations).toEqual([]);
  });

  it('does not throw on null or undefined', () => {
    expect(() => normalizeAdminPlatformStats(null)).not.toThrow();
    expect(() => normalizeAdminPlatformStats(undefined)).not.toThrow();
    const stats = normalizeAdminPlatformStats(null);
    expect(stats.totalOrganizations).toBe(0);
    expect(stats.planDistribution).toEqual([]);
  });
});

describe('normalizeAdminHealthStats', () => {
  it('returns empty platforms when payload missing', () => {
    expect(normalizeAdminHealthStats(null).platforms).toEqual([]);
    expect(normalizeAdminHealthStats(undefined).platforms).toEqual([]);
  });

  it('normalizes partial platform rows and drops invalid entries', () => {
    const stats = normalizeAdminHealthStats({
      platforms: [
        {
          platform: 'TRENDYOL',
          activeConnections: '12',
          errorRate24h: 5,
          averageSyncDurationMs: 1200.4,
          lastSyncAt: '2026-05-20T10:00:00.000Z',
        },
        { platform: '' },
        null,
      ],
    });
    expect(stats.platforms).toHaveLength(1);
    expect(stats.platforms[0]).toEqual({
      platform: 'TRENDYOL',
      activeConnections: 12,
      errorRate24h: 0.05,
      averageSyncDurationMs: 1200,
      lastSyncAt: '2026-05-20T10:00:00.000Z',
    });
  });
});

describe('formatAdminHealthErrorRate', () => {
  it('formats fraction as percent with tr-TR locale', () => {
    expect(formatAdminHealthErrorRate(0.125)).toBe('12,5%');
    expect(formatAdminHealthErrorRate(0)).toBe('0%');
  });

  it('returns em dash for invalid values', () => {
    expect(formatAdminHealthErrorRate(null)).toBe('—');
    expect(formatAdminHealthErrorRate(Number.NaN)).toBe('—');
  });
});
