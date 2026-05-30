import { describe, expect, it } from 'vitest';

import {
  CUSTOMERS_SEGMENTS_LEAF_LABEL,
  formatCustomerSegmentsNavContext,
  formatCustomersNavContext,
  resolveCustomersNavGroupLabel,
} from './customers-nav-context';

const t = (key: string): string => {
  const map: Record<string, string> = {
    'nav.nativeAccounting': 'Ön Muhasebe',
    'nav.customers': 'Müşteriler',
  };
  return map[key] ?? key;
};

describe('customers-nav-context', () => {
  it('formatCustomersNavContext uses sidebar group when present', () => {
    expect(
      formatCustomersNavContext('E-Ticaret', 'Müşteriler', ['INTEGRATION'], t),
    ).toBe('E-Ticaret > Müşteriler');
  });

  it('formatCustomersNavContext falls back to Ön Muhasebe for accounting orgs', () => {
    expect(
      formatCustomersNavContext(undefined, 'Müşteriler', ['ACCOUNTING'], t),
    ).toBe('Ön Muhasebe > Müşteriler');
  });

  it('formatCustomerSegmentsNavContext includes Segmentler leaf', () => {
    expect(
      formatCustomerSegmentsNavContext(undefined, t('nav.customers'), ['ACCOUNTING'], t),
    ).toBe('Ön Muhasebe > Müşteriler > Segmentler');
  });

  it('resolveCustomersNavGroupLabel returns undefined without accounting line', () => {
    expect(resolveCustomersNavGroupLabel(undefined, ['INTEGRATION'], t)).toBeUndefined();
  });

  it('segments leaf label constant is defined', () => {
    expect(CUSTOMERS_SEGMENTS_LEAF_LABEL).toBe('Segmentler');
  });
});
