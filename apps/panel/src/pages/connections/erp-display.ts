export interface ErpCredentialField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  required: boolean;
}

export interface ErpOption {
  id: string;
  label: string;
  logo: string;
  fields: ErpCredentialField[];
}

export const ERP_OPTIONS: ErpOption[] = [
  {
    id: 'BIZIMHESAP',
    label: 'BizimHesap',
    logo: '📊',
    fields: [
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        required: true,
      },
      { key: 'companyId', label: 'Firma ID', type: 'text', required: true },
    ],
  },
  {
    id: 'PARASUT',
    label: 'Paraşüt',
    logo: '🧾',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
      },
      { key: 'companyId', label: 'Şirket ID', type: 'text', required: true },
    ],
  },
  {
    id: 'TSOFT',
    label: 'T-Soft',
    logo: '🏬',
    fields: [
      {
        key: 'storeUrl',
        label: 'Mağaza URL',
        type: 'text',
        placeholder: 'https://magaza.com',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
      },
    ],
  },
  {
    id: 'TICIMAX',
    label: 'Ticimax',
    logo: '🛒',
    fields: [
      { key: 'siteUrl', label: 'Site URL', type: 'text', required: true },
      {
        key: 'username',
        label: 'Kullanıcı Adı',
        type: 'text',
        required: true,
      },
      {
        key: 'password',
        label: 'Şifre',
        type: 'password',
        required: true,
      },
    ],
  },
];

export function getErpBranding(erpType: string): {
  label: string;
  logo: string;
  accountFieldLabel: string;
} {
  const opt = ERP_OPTIONS.find((o) => o.id === erpType);
  if (opt) {
    return {
      label: opt.label,
      logo: opt.logo,
      accountFieldLabel: opt.fields[0]?.label ?? 'Hesap',
    };
  }
  return { label: erpType, logo: '🔗', accountFieldLabel: 'Hesap' };
}
