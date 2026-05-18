import type { ErpOption } from '@/pages/onboarding/onboarding.types';

import { getErpFormFields } from '@/lib/connection-form-fields';
import { getErpDisplay } from '@/lib/platform-display';
import { ERP_OPTIONS as ONBOARDING_ERP_OPTIONS } from '@/pages/onboarding/onboarding.options';

export const ERP_OPTIONS: ErpOption[] = ONBOARDING_ERP_OPTIONS;

export function getErpBranding(erpType: string): {
  label: string;
  logo: string;
  accountFieldLabel: string;
} {
  const d = getErpDisplay(erpType);
  const fields = getErpFormFields(erpType);
  return {
    label: d.label,
    logo: d.logo,
    accountFieldLabel: fields[0]?.label ?? 'Hesap',
  };
}
