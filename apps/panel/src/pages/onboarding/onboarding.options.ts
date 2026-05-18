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
    id: 'N11',
    label: 'N11',
    logo: '🔶',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
    ],
  },
  {
    id: 'CICEKSEPETI',
    label: 'Çiçeksepeti',
    logo: '🌸',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  },
  {
    id: 'IDEASOFT',
    label: 'İdeasoft',
    logo: '💡',
    fields: [
      {
        key: 'storeUrl',
        label: 'Mağaza URL',
        type: 'text',
        placeholder: 'https://magaza.com',
        required: true,
      },
      { key: 'apiKey', label: 'Client ID', type: 'text', required: true },
      { key: 'apiSecret', label: 'Client Secret', type: 'password', required: true },
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
  {
    id: 'AMAZON_TR',
    label: 'Amazon.com.tr',
    logo: '📦',
    fields: [
      { key: 'clientId', label: 'Client ID (LWA)', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true },
      { key: 'sellerId', label: 'Seller ID', type: 'text', required: true },
    ],
  },
  {
    id: 'PTTAVM',
    label: 'PTT AVM',
    logo: '📬',
    fields: [
      { key: 'storeId', label: 'Mağaza ID', type: 'text', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },
  {
    id: 'WOOCOMMERCE',
    label: 'WooCommerce',
    logo: '🛒',
    fields: [
      {
        key: 'storeUrl',
        label: 'Mağaza URL',
        type: 'text',
        placeholder: 'https://magaza.com',
        required: true,
      },
      { key: 'consumerKey', label: 'Consumer Key', type: 'text', required: true },
      {
        key: 'consumerSecret',
        label: 'Consumer Secret',
        type: 'password',
        required: true,
      },
    ],
  },
  {
    id: 'SHOPIFY',
    label: 'Shopify',
    logo: '🛍️',
    fields: [
      {
        key: 'shopDomain',
        label: 'Shop Domain',
        type: 'text',
        placeholder: 'mystore.myshopify.com',
        required: true,
      },
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
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
