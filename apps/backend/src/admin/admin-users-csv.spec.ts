import {
  ADMIN_USERS_CSV_HEADERS,
  ADMIN_USERS_EXPORT_MAX,
  buildAdminUsersCsv,
} from './admin-users-csv';
import type { AdminUserListItem } from './admin.types';

describe('buildAdminUsersCsv', () => {
  const row: AdminUserListItem = {
    id: 'user-1',
    email: 'demo@example.com',
    name: 'Demo Kullanıcı',
    role: 'ADMIN',
    suspended: false,
    lastLoginAt: new Date('2026-05-22T10:30:00.000Z'),
    createdAt: new Date('2026-01-01T08:00:00.000Z'),
    organization: {
      id: 'org-1',
      name: 'Demo A.Ş.',
      slug: 'demo-as',
    },
  };

  it('uses Turkish headers and UTF-8 BOM', () => {
    const csv = buildAdminUsersCsv([row]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain(ADMIN_USERS_CSV_HEADERS.join(','));
    expect(csv).toContain('Demo Kullanıcı');
    expect(csv).toContain('Yönetici');
    expect(csv).toContain('Demo A.Ş.');
  });

  it('caps export max constant at 500', () => {
    expect(ADMIN_USERS_EXPORT_MAX).toBe(500);
  });
});
