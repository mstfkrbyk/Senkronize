import { describe, expect, it } from 'vitest';

import {
  formatStockNavContext,
  resolveStockNavGroupLabel,
} from './stock-nav-context';

const t = (key: string): string => {
  const map: Record<string, string> = {
    'nav.ecommerce': 'E-Ticaret',
    'nav.nativeAccounting': 'Ön Muhasebe',
  };
  return map[key] ?? key;
};

describe('stock-nav-context', () => {
  it('formatStockNavContext builds group > page', () => {
    expect(
      formatStockNavContext('E-Ticaret', 'Hareketler', ['INTEGRATION'], 'NATIVE', t),
    ).toBe('E-Ticaret > Hareketler');
  });

  it('resolveStockNavGroupLabel falls back to native accounting for accounting-only org', () => {
    expect(
      resolveStockNavGroupLabel(undefined, ['ACCOUNTING'], 'NATIVE', t),
    ).toBe('Ön Muhasebe');
  });

  it('resolveStockNavGroupLabel falls back to ecommerce for integration-only org', () => {
    expect(
      resolveStockNavGroupLabel(undefined, ['INTEGRATION'], 'NATIVE', t),
    ).toBe('E-Ticaret');
  });
});
