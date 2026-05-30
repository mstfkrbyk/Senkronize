import type { TFunction } from 'i18next';

import { formatNavPageContext } from '@/lib/nav-page-context';

/** Kayıt sihirbazı adım etiketi (üst bağlam yaprak segmenti). */
export function formatRegisterStepLabel(step: number, t: TFunction): string {
  return t('register.nav.step', { step });
}

/** Üst bağlam: «Kayıt > Adım N»; partner davetinde «Ortak > Kayıt > Adım N». */
export function formatRegisterNavContext(
  step: number,
  t: TFunction,
  options?: { partnerInvite?: boolean },
): string {
  const stepLabel = formatRegisterStepLabel(step, t);
  const pageLabel = t('register.nav.pageLabel');
  if (options?.partnerInvite) {
    return formatNavPageContext(t('nav.common'), pageLabel, stepLabel);
  }
  return formatNavPageContext(undefined, pageLabel, stepLabel);
}
