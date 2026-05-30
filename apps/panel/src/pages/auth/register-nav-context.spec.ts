import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  formatRegisterNavContext,
  formatRegisterStepLabel,
} from './register-nav-context';

const t = ((key: string, opts?: { step?: number }) => {
  const map: Record<string, string> = {
    'register.nav.step': `Adım ${opts?.step ?? ''}`,
    'register.nav.pageLabel': 'Kayıt',
    'nav.common': 'Ortak',
  };
  return map[key] ?? key;
}) as TFunction;

describe('register-nav-context', () => {
  it('formatRegisterStepLabel returns Adım N', () => {
    expect(formatRegisterStepLabel(1, t)).toBe('Adım 1');
    expect(formatRegisterStepLabel(5, t)).toBe('Adım 5');
  });

  it('formatRegisterNavContext builds Kayıt > Adım N', () => {
    expect(formatRegisterNavContext(2, t)).toBe('Kayıt > Adım 2');
  });

  it('formatRegisterNavContext builds Ortak > Kayıt > Adım N for partner invite', () => {
    expect(formatRegisterNavContext(3, t, { partnerInvite: true })).toBe(
      'Ortak > Kayıt > Adım 3',
    );
  });
});
