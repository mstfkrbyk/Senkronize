import { describe, expect, it } from 'vitest';

import {
  ADMIN_PLATFORM_AUDIT_PATH,
  orgHasTenantAuditLogsNav,
  resolveAdminDashboardAuditHref,
  resolveSuperAdminTenantAuditHref,
  TENANT_AUDIT_LOGS_PATH,
} from '@/lib/admin-audit-nav';

describe('admin-audit-nav', () => {
  it('detects tenant audit in common nav for direct org', () => {
    expect(
      orgHasTenantAuditLogsNav({
        orgType: 'DIRECT',
        orgProducts: ['INTEGRATION'],
        accountingMode: 'NATIVE',
      }),
    ).toBe(true);
  });

  it('hides tenant audit for partner org sidebar', () => {
    expect(
      orgHasTenantAuditLogsNav({
        orgType: 'PARTNER',
        orgProducts: ['INTEGRATION'],
        accountingMode: 'NATIVE',
      }),
    ).toBe(false);
  });

  it('admin dashboard links to platform audit', () => {
    expect(resolveAdminDashboardAuditHref()).toBe(ADMIN_PLATFORM_AUDIT_PATH);
  });

  it('super admin tenant href when nav visible', () => {
    expect(
      resolveSuperAdminTenantAuditHref({
        orgType: 'DIRECT',
        orgProducts: [],
        accountingMode: 'NATIVE',
      }),
    ).toBe(TENANT_AUDIT_LOGS_PATH);
  });

  it('super admin tenant href null for partner org', () => {
    expect(
      resolveSuperAdminTenantAuditHref({
        orgType: 'PARTNER',
        orgProducts: ['INTEGRATION'],
        accountingMode: 'NATIVE',
      }),
    ).toBeNull();
  });
});
