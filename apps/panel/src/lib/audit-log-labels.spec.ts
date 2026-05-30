import { describe, expect, it } from 'vitest';

import {
  buildAuditLogMetadataSummary,
  formatAuditLogAction,
  formatAuditLogResource,
  formatAuditLogResourceDisplay,
} from '@/lib/audit-log-labels';

describe('audit-log-labels', () => {
  it('bilinen partner eylemini Türkçeleştirir', () => {
    expect(formatAuditLogAction('partner.impersonation_start')).toBe(
      'Partner müşteri hesabına geçti',
    );
  });

  it('prisma middleware eylemini okunur yapar', () => {
    expect(formatAuditLogAction('MarketplaceConnection.update')).toBe(
      'Pazaryeri bağlantısı güncellendi',
    );
  });

  it('sync_ önekli eylemi açıklar', () => {
    expect(formatAuditLogAction('sync_pull_orders')).toContain('Senkronizasyon');
  });

  it('kaynak türünü Türkçeleştirir', () => {
    expect(formatAuditLogResource('ErpConnection')).toBe('ERP bağlantısı');
  });

  it('kaynak kimliğini kısaltır', () => {
    const longId = 'clxxxxxxxxxxxxxxxxxx';
    expect(formatAuditLogResourceDisplay('User', longId)).toContain('…');
  });

  it('metadata özetinde plan etiketleri kullanır', () => {
    const lines = buildAuditLogMetadataSummary(
      { previousPlan: 'BASLANGIC', newPlan: 'PRO' },
      'subscription.plan_changed',
    );
    expect(lines.some((l) => l.value === 'Başlangıç')).toBe(true);
    expect(lines.some((l) => l.value === 'Pro')).toBe(true);
  });

  it('null/undefined eylem ve kaynak için çökmez', () => {
    expect(() => formatAuditLogAction(undefined)).not.toThrow();
    expect(() => formatAuditLogAction(null)).not.toThrow();
    expect(formatAuditLogAction(null)).toBe('—');
    expect(formatAuditLogAction(undefined)).toBe('—');
    expect(formatAuditLogResource(null)).toBe('—');
    expect(formatAuditLogResourceDisplay(null, null)).toBe('—');
    expect(buildAuditLogMetadataSummary(null)).toEqual([]);
    expect(buildAuditLogMetadataSummary(undefined)).toEqual([]);
  });

  it('kuyruk hatasında iş adını çevirir', () => {
    const lines = buildAuditLogMetadataSummary(
      { jobName: 'pull-orders', platform: 'TRENDYOL' },
      'queue.job_failed',
    );
    expect(lines.some((l) => l.value === 'Sipariş çekme')).toBe(true);
  });
});
