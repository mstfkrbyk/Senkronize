import { describe, expect, it } from 'vitest';

import {
  canViewIntegrationOps,
  customerConnectionStatusLabel,
} from './integration-ops-access';

describe('canViewIntegrationOps', () => {
  it('allows SUPER_ADMIN only', () => {
    expect(canViewIntegrationOps('SUPER_ADMIN')).toBe(true);
    expect(canViewIntegrationOps('OWNER')).toBe(false);
    expect(canViewIntegrationOps('ADMIN')).toBe(false);
    expect(canViewIntegrationOps('PARTNER')).toBe(false);
    expect(canViewIntegrationOps(undefined)).toBe(false);
  });
});

describe('customerConnectionStatusLabel', () => {
  it('uses non-technical labels', () => {
    expect(customerConnectionStatusLabel('active')).toBe('Çalışıyor');
    expect(customerConnectionStatusLabel('error')).toBe('Destek gerekebilir');
    expect(customerConnectionStatusLabel('warning')).toBe('Kontrol ediliyor');
  });
});
