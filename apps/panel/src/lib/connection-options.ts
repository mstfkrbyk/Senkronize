import {
  type ConnectionFormFieldDef,
  ERP_CONNECTION_FORM_FIELDS,
  ERP_TYPE_IDS,
  ECOMMERCE_MARKETPLACE_IDS,
  MARKETPLACE_CONNECTION_FORM_FIELDS,
  MARKETPLACE_PLATFORM_IDS,
} from '@/lib/connection-form-fields';
import { getErpDisplay, getMarketplaceDisplay } from '@/lib/platform-display';
import type {
  CredentialField,
  ErpOption,
  MarketplaceOption,
} from '@/pages/onboarding/onboarding.types';

function toCredentialField(f: ConnectionFormFieldDef): CredentialField {
  const type: CredentialField['type'] =
    f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : 'text';
  return {
    key: f.key,
    label: f.label,
    placeholder: f.placeholder,
    type,
    required: f.required,
  };
}

export function buildMarketplaceOptions(): MarketplaceOption[] {
  const pure = MARKETPLACE_PLATFORM_IDS.filter(
    (id) => MARKETPLACE_CONNECTION_FORM_FIELDS[id],
  ).map((id) => {
    const d = getMarketplaceDisplay(id);
    return {
      id,
      label: d.label,
      logo: d.logo,
      fields: MARKETPLACE_CONNECTION_FORM_FIELDS[id].map(toCredentialField),
    };
  });

  const ecommerce = ECOMMERCE_MARKETPLACE_IDS.filter(
    (id) => MARKETPLACE_CONNECTION_FORM_FIELDS[id],
  ).map((id) => {
    const d = getMarketplaceDisplay(id);
    return {
      id,
      label: d.label,
      logo: d.logo,
      fields: MARKETPLACE_CONNECTION_FORM_FIELDS[id].map(toCredentialField),
    };
  });

  return [...pure, ...ecommerce];
}

export function buildErpOptions(): ErpOption[] {
  return ERP_TYPE_IDS.filter((id) => ERP_CONNECTION_FORM_FIELDS[id]).map(
    (id) => {
      const d = getErpDisplay(id);
      return {
        id,
        label: d.label,
        logo: d.logo,
        fields: ERP_CONNECTION_FORM_FIELDS[id].map(toCredentialField),
      };
    },
  );
}
