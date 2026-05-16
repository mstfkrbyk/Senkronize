import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';

export function getMarketplaceBranding(platform: string): {
  label: string;
  logo: string;
  accountFieldLabel: string;
} {
  const opt = MARKETPLACE_OPTIONS.find((o) => o.id === platform);
  if (opt) {
    return {
      label: opt.label,
      logo: opt.logo,
      accountFieldLabel: opt.fields[0]?.label ?? 'Hesap',
    };
  }
  return { label: platform, logo: '🔗', accountFieldLabel: 'Hesap' };
}
