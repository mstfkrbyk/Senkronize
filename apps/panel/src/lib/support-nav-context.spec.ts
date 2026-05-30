import { describe, expect, it } from 'vitest';

import {
  formatSupportNavContext,
  isSupportRoute,
  resolveSupportSubPageTitle,
} from './support-nav-context';

describe('support-nav-context', () => {
  it('isSupportRoute matches /support and children', () => {
    expect(isSupportRoute('/support')).toBe(true);
    expect(isSupportRoute('/support/ticket-1')).toBe(true);
    expect(isSupportRoute('/support/help/article-slug')).toBe(true);
    expect(isSupportRoute('/orders')).toBe(false);
  });

  it('formatSupportNavContext builds group > page and optional leaf', () => {
    expect(formatSupportNavContext('Ortak', 'Destek')).toBe('Ortak > Destek');
    expect(formatSupportNavContext(undefined, 'Destek')).toBe('Destek');
    expect(formatSupportNavContext('Ortak', 'Destek', 'TKT-001')).toBe(
      'Ortak > Destek > TKT-001',
    );
  });

  it('resolveSupportSubPageTitle returns undefined for list route', () => {
    expect(resolveSupportSubPageTitle('/support')).toBeUndefined();
    expect(resolveSupportSubPageTitle('/support/help/foo')).toBeUndefined();
  });

  it('resolveSupportSubPageTitle returns label for new ticket route', () => {
    expect(resolveSupportSubPageTitle('/support/new')).toBe('Yeni Talep');
  });

  it('formatSupportNavContext builds new ticket leaf', () => {
    expect(formatSupportNavContext('Ortak', 'Destek', 'Yeni Talep')).toBe(
      'Ortak > Destek > Yeni Talep',
    );
  });
});
