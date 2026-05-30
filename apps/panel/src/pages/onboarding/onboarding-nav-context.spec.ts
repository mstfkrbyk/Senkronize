import { describe, expect, it } from 'vitest';

import {
  formatOnboardingNavContext,
  formatOnboardingRootNavContext,
  resolveProductPlanStepLabel,
} from './onboarding-nav-context';

describe('onboarding-nav-context', () => {
  it('formatOnboardingRootNavContext builds Ortak > Kurulum', () => {
    expect(formatOnboardingRootNavContext()).toBe('Ortak > Kurulum');
  });

  it('formatOnboardingNavContext builds Ortak > Kurulum > step', () => {
    expect(formatOnboardingNavContext('Firma Bilgileri')).toBe(
      'Ortak > Kurulum > Firma Bilgileri',
    );
  });

  it('resolveProductPlanStepLabel reflects locked product line', () => {
    expect(resolveProductPlanStepLabel(false)).toBe('Ürün ve paket');
    expect(resolveProductPlanStepLabel(true)).toBe('Paket seçimi');
  });
});
