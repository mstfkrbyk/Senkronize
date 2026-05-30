import { describe, expect, it } from 'vitest';

import {
  auditLogMatchesProductCategory,
  buildAuditLogActionPresets,
  buildAuditLogProductCategoryOptions,
  classifyAuditLogProductCategory,
  filterAuditLogsForDisplay,
  isIntegrationAuditLog,
} from '@/lib/audit-log-categories';
import type { AuditLogEntry } from '@/types/audit-log';

function entry(
  partial: Pick<AuditLogEntry, 'action' | 'resource'> &
    Partial<Pick<AuditLogEntry, 'metadata'>>,
): AuditLogEntry {
  return {
    id: '1',
    action: partial.action,
    resource: partial.resource,
    resourceId: null,
    userId: 'u1',
    userEmail: null,
    userName: null,
    createdAt: new Date().toISOString(),
    metadata: partial.metadata ?? {},
  };
}

describe('audit-log-categories', () => {
  it('pazaryeri bağlantı kaydını entegrasyon sayar', () => {
    const row = entry({
      action: 'MarketplaceConnection.update',
      resource: 'MarketplaceConnection',
    });
    expect(isIntegrationAuditLog(row)).toBe(true);
    expect(classifyAuditLogProductCategory(row)).toBe('integration');
  });

  it('erp kaydını muhasebe sayar', () => {
    const row = entry({ action: 'erp.invoice_created', resource: 'Invoice' });
    expect(classifyAuditLogProductCategory(row)).toBe('accounting');
  });

  it('auth kaydını sistem sayar', () => {
    const row = entry({ action: 'auth.password_changed', resource: 'User' });
    expect(classifyAuditLogProductCategory(row)).toBe('system');
  });

  it('accounting-only org pazaryeri kayıtlarını filtreler', () => {
    const logs = [
      entry({
        action: 'MarketplaceConnection.create',
        resource: 'MarketplaceConnection',
      }),
      entry({ action: 'subscription.plan_changed', resource: 'Subscription' }),
    ];
    const filtered = filterAuditLogsForDisplay(logs, {
      orgProducts: ['ACCOUNTING'],
      productCategory: 'all',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.action).toBe('subscription.plan_changed');
  });

  it('ürün kategorisi eşleşmesi', () => {
    const row = entry({ action: 'sync_completed', resource: 'Sync' });
    expect(auditLogMatchesProductCategory(row, 'integration')).toBe(true);
    expect(auditLogMatchesProductCategory(row, 'accounting')).toBe(false);
  });

  it('accounting-only eylem listesinde sync yok', () => {
    const presets = buildAuditLogActionPresets(['ACCOUNTING']);
    expect(presets.map((p) => p.value)).not.toContain('sync_*');
  });

  it('accounting-only chip seçeneklerinde entegrasyon yok', () => {
    const options = buildAuditLogProductCategoryOptions(['ACCOUNTING']);
    expect(options.map((o) => o.value)).not.toContain('integration');
  });
});
