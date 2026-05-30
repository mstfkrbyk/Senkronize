import { describe, expect, it } from 'vitest';

import { formatErpSetupNavContext } from './erp-setup-nav-context';

describe('erp-setup-nav-context', () => {
  it('formatErpSetupNavContext builds Entegrasyonlar > Kurulum', () => {
    expect(formatErpSetupNavContext('Entegrasyonlar')).toBe(
      'Entegrasyonlar > Kurulum',
    );
  });
});
