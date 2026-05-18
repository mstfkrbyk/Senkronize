import { getMarketplaceFormFields } from '@/lib/connection-form-fields';
import { getMarketplaceDisplay } from '@/lib/platform-display';

export function getMarketplaceBranding(platform: string): {
  label: string;
  logo: string;
  accountFieldLabel: string;
} {
  const d = getMarketplaceDisplay(platform);
  const fields = getMarketplaceFormFields(platform);
  return {
    label: d.label,
    logo: d.logo,
    accountFieldLabel: fields[0]?.label ?? 'Hesap',
  };
}
