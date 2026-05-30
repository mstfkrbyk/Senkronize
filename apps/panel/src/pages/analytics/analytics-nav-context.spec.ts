import { describe, expect, it } from 'vitest';

import {
  formatAnalyticsNavContext,
  resolveAnalyticsNavGroupLabel,
} from './analytics-nav-context';

const t = (key: string): string => {
  const map: Record<string, string> = {
    'nav.ecommerce': 'E-Ticaret',
  };
  return map[key] ?? key;
};

describe('analytics-nav-context', () => {
  it('formatAnalyticsNavContext uses sidebar group when present', () => {
    expect(
      formatAnalyticsNavContext('E-Ticaret', 'Analitik', ['INTEGRATION'], t),
    ).toBe('E-Ticaret > Analitik');
  });

  it('formatAnalyticsNavContext falls back to E-Ticaret for integration orgs', () => {
    expect(
      formatAnalyticsNavContext(undefined, 'Analitik', ['INTEGRATION'], t),
    ).toBe('E-Ticaret > Analitik');
  });

  it('resolveAnalyticsNavGroupLabel returns undefined without integration line', () => {
    expect(resolveAnalyticsNavGroupLabel(undefined, ['ACCOUNTING'], t)).toBeUndefined();
  });
});
