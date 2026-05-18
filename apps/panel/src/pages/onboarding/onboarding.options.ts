import type { ErpOption, MarketplaceOption } from './onboarding.types';

export const MARKETPLACE_OPTIONS: MarketplaceOption[] = [
  {
    id: 'TRENDYOL',
    label: 'Trendyol',
    logo: '🛍️',
    fields: [
      { key: 'sellerId', label: 'Satıcı ID', type: 'text', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
    ],
  },
  {
    id: 'HEPSIBURADA',
    label: 'Hepsiburada',
    logo: '🏪',
    fields: [
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
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
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },
  {
    id: 'TICIMAX',
    label: 'Ticimax',
    logo: '🛒',
    fields: [
      { key: 'siteUrl', label: 'Site URL', type: 'text', required: true },
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
    ],
  },
];

export const ERP_OPTIONS: ErpOption[] = [
  {
    id: 'BIZIMHESAP',
    label: 'BizimHesap',
    logo: '📊',
    fields: [
      { key: 'apiToken', label: 'API Token', type: 'password', required: true },
      { key: 'companyId', label: 'Firma ID', type: 'text', required: true },
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
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },
  {
    id: 'TICIMAX',
    label: 'Ticimax',
    logo: '🛒',
    fields: [
      { key: 'siteUrl', label: 'Site URL', type: 'text', required: true },
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
    ],
  },
];
