import { describe, expect, it } from 'vitest';

import { buildMobileNavEntries } from './mobile-bottom-nav';

describe('buildMobileNavEntries', () => {
  it('PARTNER org without impersonation gets partner portal shortcuts', () => {
    const entries = buildMobileNavEntries({
      orgType: 'PARTNER',
      orgProducts: ['INTEGRATION', 'ACCOUNTING'],
      accountingMode: 'NATIVE',
      isImpersonating: false,
    });
    const paths = entries
      .filter((e) => e.kind === 'link')
      .map((e) => (e.kind === 'link' ? e.path : ''));
    expect(paths).toEqual(['/partner', '/partner/clients', '/partner/commission']);
    expect(entries.some((e) => e.kind === 'menu')).toBe(true);
    expect(paths).not.toContain('/dashboard');
    expect(paths).not.toContain('/orders');
  });

  it('PARTNER org while impersonating uses customer mobile nav', () => {
    const entries = buildMobileNavEntries({
      orgType: 'PARTNER',
      orgProducts: ['INTEGRATION'],
      accountingMode: 'NATIVE',
      isImpersonating: true,
    });
    const paths = entries
      .filter((e) => e.kind === 'link')
      .map((e) => (e.kind === 'link' ? e.path : ''));
    expect(paths).toContain('/dashboard');
    expect(paths).not.toContain('/partner/clients');
  });
});
