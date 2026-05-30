import {
  ADMIN_PLATFORM_ACTIVITY_CSV_HEADERS,
  ADMIN_PLATFORM_ACTIVITY_EXPORT_MAX,
  buildAdminPlatformActivityCsv,
} from './admin-platform-activity-csv';
import type { ActivityItem } from './admin.types';

describe('buildAdminPlatformActivityCsv', () => {
  const row: ActivityItem = {
    id: 'log-1',
    action: 'admin.impersonation_start',
    resourceType: 'Organization',
    resourceId: 'org-target',
    actorUserId: 'user-1',
    actorOrgId: 'org-actor',
    actorOrgName: 'Platform Org',
    impersonatedOrgId: 'org-client',
    impersonatedOrgName: 'Müşteri A.Ş.',
    createdAt: new Date('2026-05-22T10:30:00.000Z'),
  };

  it('uses Turkish headers and UTF-8 BOM', () => {
    const csv = buildAdminPlatformActivityCsv([row]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain(ADMIN_PLATFORM_ACTIVITY_CSV_HEADERS.join(','));
    expect(csv).toContain('Admin müşteri hesabına geçti');
    expect(csv).toContain('Platform Org');
    expect(csv).toContain('Müşteri A.Ş.');
  });

  it('caps export max constant at 500', () => {
    expect(ADMIN_PLATFORM_ACTIVITY_EXPORT_MAX).toBe(500);
  });

  it('escapes CSV cells with commas and quotes', () => {
    const csv = buildAdminPlatformActivityCsv([
      {
        ...row,
        actorOrgName: 'Org, "Ltd"',
        impersonatedOrgName: 'Müşteri\nSatır',
      },
    ]);
    expect(csv).toContain('"Org, ""Ltd"""');
    expect(csv).toContain('"Müşteri\nSatır"');
  });

  it('omits impersonation columns when not impersonating', () => {
    const csv = buildAdminPlatformActivityCsv([
      {
        ...row,
        impersonatedOrgId: null,
        impersonatedOrgName: null,
      },
    ]);
    const dataLine = csv.split('\n')[1] ?? '';
    expect(dataLine.endsWith(',,')).toBe(true);
  });

  it('returns header row only for empty export', () => {
    const csv = buildAdminPlatformActivityCsv([]);
    const lines = csv.replace(/^\uFEFF/, '').split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(ADMIN_PLATFORM_ACTIVITY_CSV_HEADERS.join(','));
  });

  it('labels partner payout and uses actor org id when name missing', () => {
    const csv = buildAdminPlatformActivityCsv([
      {
        ...row,
        action: 'partner.payout_request',
        actorOrgName: null,
        impersonatedOrgId: null,
        impersonatedOrgName: null,
      },
    ]);
    expect(csv).toContain('Partner ödeme talebi');
    expect(csv).toContain('org-actor');
    expect(csv).not.toContain('Platform Org');
  });

  it('formats resource with truncated id for long resourceId', () => {
    const longId = 'org-abcdefghijklmnop';
    const csv = buildAdminPlatformActivityCsv([
      {
        ...row,
        resourceId: longId,
      },
    ]);
    expect(csv).toContain('Organizasyon · org-abcd…');
  });

  it('joins multiple activity rows', () => {
    const csv = buildAdminPlatformActivityCsv([
      row,
      {
        ...row,
        id: 'log-2',
        action: 'admin.partner_link_approve',
        createdAt: new Date('2026-05-22T11:00:00.000Z'),
      },
    ]);
    const lines = csv.replace(/^\uFEFF/, '').split('\n');
    expect(lines).toHaveLength(3);
    expect(csv).toContain('Partner bağlantısı onaylandı');
  });
});
