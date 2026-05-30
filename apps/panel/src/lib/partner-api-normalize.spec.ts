import { describe, expect, it } from 'vitest';

import {
  normalizeClientOnboardingInvites,
  normalizeCommissionReport,
  normalizeCommissionSummary,
  normalizePartnerCommissionsPage,
  normalizePartnerDashboard,
  normalizePartnerListItems,
  normalizePartnerPayoutRequest,
  normalizePartnerPayoutRequests,
  normalizePartnerPerformance,
  normalizePartnerRelationship,
  normalizePartnerRelationships,
} from '@/lib/partner-api-normalize';

describe('normalizePartnerRelationships', () => {
  it('returns empty array for null and non-arrays', () => {
    expect(normalizePartnerRelationships(null)).toEqual([]);
    expect(normalizePartnerRelationships(undefined)).toEqual([]);
    expect(normalizePartnerRelationships({})).toEqual([]);
  });

  it('filters invalid relationship rows', () => {
    const rows = normalizePartnerRelationships([
      { id: '', partnerOrgId: 'p1' },
      {
        id: 'rel-1',
        partnerOrgId: 'p1',
        status: 'ACTIVE',
        commissionPct: 15,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('rel-1');
    expect(rows[0]!.status).toBe('ACTIVE');
    expect(rows[0]!.commissionPct).toBe('15');
  });
});

describe('normalizePartnerRelationship', () => {
  it('returns null when id or partnerOrgId missing', () => {
    expect(normalizePartnerRelationship(null)).toBeNull();
    expect(normalizePartnerRelationship({ id: 'r1' })).toBeNull();
    expect(
      normalizePartnerRelationship({ id: 'r1', partnerOrgId: '' }),
    ).toBeNull();
  });

  it('defaults invalid status to PENDING', () => {
    const row = normalizePartnerRelationship({
      id: 'r1',
      partnerOrgId: 'p1',
      status: 'INVALID',
    });
    expect(row?.status).toBe('PENDING');
  });
});

describe('normalizePartnerDashboard', () => {
  it('returns empty clients and activities for null payload', () => {
    const dash = normalizePartnerDashboard(null);
    expect(dash.clients).toEqual([]);
    expect(dash.recentActivities).toEqual([]);
    expect(dash.totalClients).toBe(0);
  });

  it('filters invalid client rows', () => {
    const dash = normalizePartnerDashboard({
      clients: [{ clientOrgId: '', relationshipId: 'x' }],
      totalClients: 5,
    });
    expect(dash.clients).toEqual([]);
    expect(dash.totalClients).toBe(5);
  });
});

describe('normalizePartnerListItems', () => {
  it('returns empty array for null', () => {
    expect(normalizePartnerListItems(null)).toEqual([]);
  });

  it('normalizes list items and skips invalid ids', () => {
    const items = normalizePartnerListItems([
      { id: '' },
      { id: 'p1', name: 'Partner A', slug: 'a' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe('Partner A');
    expect(items[0]!.activeClientCount).toBe(0);
  });
});

describe('normalizeClientOnboardingInvites', () => {
  it('returns empty array for null', () => {
    expect(normalizeClientOnboardingInvites(null)).toEqual([]);
  });
});

describe('normalizeCommissionSummary', () => {
  it('returns empty ledger when missing', () => {
    expect(normalizeCommissionSummary(null).ledger).toEqual([]);
  });
});

describe('normalizePartnerCommissionsPage', () => {
  it('defaults pagination from items length', () => {
    const page = normalizePartnerCommissionsPage({
      items: [{ id: 'c1', type: 'EARN', amount: '10', status: 'PENDING' }],
    });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.page).toBe(1);
  });
});

describe('normalizeCommissionReport', () => {
  it('returns empty rows and trend for null', () => {
    const report = normalizeCommissionReport(null);
    expect(report.rows).toEqual([]);
    expect(report.trendLast6Months).toEqual([]);
  });
});

describe('normalizePartnerPerformance', () => {
  it('returns empty top clients for null', () => {
    expect(normalizePartnerPerformance(null).topProfitableClients).toEqual([]);
  });
});

describe('normalizePartnerPayoutRequest', () => {
  it('returns null when id or partnerOrgId missing', () => {
    expect(normalizePartnerPayoutRequest(null)).toBeNull();
    expect(normalizePartnerPayoutRequest({ id: 'r1' })).toBeNull();
    expect(
      normalizePartnerPayoutRequest({ id: 'r1', partnerOrgId: '' }),
    ).toBeNull();
  });

  it('parses string amount and defaults invalid status to PENDING', () => {
    const row = normalizePartnerPayoutRequest({
      id: 'req-1',
      partnerOrgId: 'p1',
      amountTRY: '750.5',
      status: 'UNKNOWN',
      createdAt: '2026-05-01T00:00:00.000Z',
    });
    expect(row?.amountTRY).toBe(750.5);
    expect(row?.status).toBe('PENDING');
  });

  it('normalizes partner name and reviewedAt', () => {
    const row = normalizePartnerPayoutRequest({
      id: 'req-2',
      partnerOrgId: 'p1',
      partnerName: '  Acme Partner  ',
      amountTRY: 100,
      status: 'APPROVED',
      createdAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-02T12:00:00.000Z',
    });
    expect(row?.partnerName).toBe('Acme Partner');
    expect(row?.reviewedAt).toBe('2026-05-02T12:00:00.000Z');
    expect(row?.status).toBe('APPROVED');
  });
});

describe('normalizePartnerPayoutRequests', () => {
  it('filters invalid payout rows', () => {
    const rows = normalizePartnerPayoutRequests([
      { id: '', partnerOrgId: 'p1' },
      {
        id: 'req-1',
        partnerOrgId: 'p1',
        amountTRY: 500,
        status: 'PENDING',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amountTRY).toBe(500);
    expect(rows[0]!.status).toBe('PENDING');
  });

  it('returns empty array for null and non-arrays', () => {
    expect(normalizePartnerPayoutRequests(null)).toEqual([]);
    expect(normalizePartnerPayoutRequests(undefined)).toEqual([]);
  });
});
