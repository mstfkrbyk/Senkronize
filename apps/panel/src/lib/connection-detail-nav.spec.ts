import { describe, expect, it } from 'vitest';

import {
  isConnectionDetailPath,
  isErpConnectionDetailPath,
  isErpSetupPath,
  isMarketplaceConnectionDetailPath,
  resolveConnectionDetailNavGroup,
} from './connection-detail-nav';

describe('connection-detail-nav', () => {
  it('ERP detay rotasını ayırır', () => {
    expect(isErpConnectionDetailPath('/connections/erp/abc')).toBe(true);
    expect(isMarketplaceConnectionDetailPath('/connections/erp/abc')).toBe(false);
    expect(resolveConnectionDetailNavGroup('/connections/erp/abc')).toBe('externalErp');
  });

  it('pazaryeri detay rotasında grup üst menüden çözülür', () => {
    expect(isMarketplaceConnectionDetailPath('/connections/mp-1')).toBe(true);
    expect(isErpConnectionDetailPath('/connections/mp-1')).toBe(false);
    expect(resolveConnectionDetailNavGroup('/connections/mp-1')).toBeUndefined();
  });

  it('liste ve kurulum rotalarını detay saymaz', () => {
    expect(isConnectionDetailPath('/connections')).toBe(false);
    expect(isConnectionDetailPath('/connections/erp/setup')).toBe(false);
  });

  it('ERP kurulum rotası externalErp grubuna bağlanır', () => {
    expect(isErpSetupPath('/connections/erp/setup')).toBe(true);
    expect(resolveConnectionDetailNavGroup('/connections/erp/setup')).toBe(
      'externalErp',
    );
  });
});
