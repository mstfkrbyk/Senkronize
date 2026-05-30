import { describe, expect, it } from 'vitest';

import {
  formatPartnerNavContext,
  isPartnerPortalRoute,
  resolvePartnerSubPageTitle,
  shouldUsePartnerMobileNav,
} from './partner-nav-context';

describe('partner-nav-context', () => {
  it('isPartnerPortalRoute matches /partner and children', () => {
    expect(isPartnerPortalRoute('/partner')).toBe(true);
    expect(isPartnerPortalRoute('/partner/commission')).toBe(true);
    expect(isPartnerPortalRoute('/dashboard')).toBe(false);
  });

  it('formatPartnerNavContext builds Partner > page', () => {
    expect(formatPartnerNavContext('Komisyon')).toBe('Partner > Komisyon');
    expect(formatPartnerNavContext(undefined)).toBe('Partner');
  });

  it('shouldUsePartnerMobileNav is true only for PARTNER without impersonation', () => {
    expect(shouldUsePartnerMobileNav('PARTNER', false)).toBe(true);
    expect(shouldUsePartnerMobileNav('PARTNER', true)).toBe(false);
    expect(shouldUsePartnerMobileNav('DIRECT', false)).toBe(false);
  });

  it('resolvePartnerSubPageTitle returns labels for sub-routes', () => {
    expect(resolvePartnerSubPageTitle('/partner')).toBeUndefined();
    expect(resolvePartnerSubPageTitle('/partner/clients')).toBe('Tüm müşteriler');
    expect(formatPartnerNavContext('Tüm müşteriler')).toBe('Partner > Tüm müşteriler');
    expect(resolvePartnerSubPageTitle('/partner/commission')).toBe('Komisyon');
    expect(resolvePartnerSubPageTitle('/partner/commission-report')).toBe(
      'Komisyon raporu',
    );
    expect(resolvePartnerSubPageTitle('/partner/performance')).toBe('Performans');
    expect(formatPartnerNavContext('Performans')).toBe('Partner > Performans');
  });
});
