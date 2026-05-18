/**
 * Pazaryeri / ERP bağlantı formları için kimlik alanı tanımları.
 * Prisma `Marketplace` ve `ErpType` enum değerleriyle birebir anahtarlanır.
 */

export interface ConnectionFormFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'password' | 'url' | 'number';
  required: boolean;
  hint?: string;
  defaultValue?: string;
}

export const MARKETPLACE_CONNECTION_FORM_FIELDS: Record<
  string,
  ConnectionFormFieldDef[]
> = {
  TRENDYOL: [
    {
      key: 'supplierId',
      label: 'Tedarikçi ID',
      type: 'text',
      required: true,
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
    },
    {
      key: 'apiSecret',
      label: 'API Secret',
      type: 'password',
      required: true,
    },
  ],
  HEPSIBURADA: [
    { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
    { key: 'password', label: 'Şifre', type: 'password', required: true },
    { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
  ],
  N11: [
    { key: 'apiKey', label: 'API Key', type: 'text', required: true },
    { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
  ],
  CICEKSEPETI: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'sellerId', label: 'Satıcı ID', type: 'text', required: true },
  ],
  AMAZON_TR: [
    { key: 'sellerId', label: 'Satıcı ID', type: 'text', required: true },
    { key: 'accessKeyId', label: 'Access Key', type: 'text', required: true },
    {
      key: 'secretAccessKey',
      label: 'Secret Key',
      type: 'password',
      required: true,
    },
    {
      key: 'refreshToken',
      label: 'Refresh Token',
      type: 'password',
      required: true,
    },
    {
      key: 'marketplaceId',
      label: 'Marketplace ID',
      type: 'text',
      required: true,
      defaultValue: 'A33AVAJ2PDY3EV',
      hint: 'Türkiye için varsayılan: A33AVAJ2PDY3EV',
    },
  ],
  PTTAVM: [
    { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
    { key: 'password', label: 'Şifre', type: 'password', required: true },
    { key: 'storeId', label: 'Mağaza ID', type: 'text', required: true },
  ],
  PAZARAMA: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
  ],
  GETIR: [
    { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
    { key: 'secret', label: 'Secret Key', type: 'password', required: true },
  ],
  GRATIS: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  BOYNER: [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      type: 'password',
      required: true,
    },
  ],
  MORHIPO: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  DOLAP: [
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'password',
      required: true,
    },
  ],
  EBAY: [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      type: 'password',
      required: true,
    },
    {
      key: 'refreshToken',
      label: 'Refresh Token',
      type: 'password',
      required: true,
    },
  ],
  ETSY: [
    { key: 'apiKey', label: 'API Key', type: 'text', required: true },
    { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
    { key: 'shopId', label: 'Mağaza ID', type: 'text', required: true },
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'password',
      required: true,
    },
  ],
  TEMU: [
    { key: 'appKey', label: 'App Key', type: 'text', required: true },
    { key: 'appSecret', label: 'App Secret', type: 'password', required: true },
  ],
  SAHIBINDEN: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
  ],
  TSOFT: [
    {
      key: 'storeUrl',
      label: 'Mağaza URL',
      type: 'url',
      placeholder: 'https://magaza.example.com',
      required: true,
      hint: 'http:// veya https:// ile tam adres girin.',
    },
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      type: 'password',
      required: true,
    },
  ],
  TICIMAX: [
    {
      key: 'storeUrl',
      label: 'Mağaza URL',
      type: 'url',
      placeholder: 'https://magaza.example.com',
      required: true,
      hint: 'http:// veya https:// ile tam adres girin.',
    },
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
  ],
  WOOCOMMERCE: [
    {
      key: 'siteUrl',
      label: 'Site URL',
      type: 'url',
      placeholder: 'https://magaza.example.com',
      required: true,
      hint: 'http:// veya https:// ile tam adres girin.',
    },
    { key: 'consumerKey', label: 'Consumer Key', type: 'text', required: true },
    {
      key: 'consumerSecret',
      label: 'Consumer Secret',
      type: 'password',
      required: true,
    },
  ],
  SHOPIFY: [
    {
      key: 'shopDomain',
      label: 'Mağaza Domain',
      type: 'text',
      placeholder: 'mystore.myshopify.com',
      required: true,
    },
    { key: 'apiKey', label: 'API Key', type: 'text', required: true },
    {
      key: 'apiSecret',
      label: 'API Secret',
      type: 'password',
      required: true,
    },
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'password',
      required: true,
    },
  ],
  IDEASOFT: [
    {
      key: 'storeUrl',
      label: 'Mağaza URL',
      type: 'url',
      placeholder: 'https://magaza.example.com',
      required: true,
      hint: 'http:// veya https:// ile tam adres girin.',
    },
    { key: 'apiKey', label: 'API Key', type: 'text', required: true },
  ],
};

export const ERP_CONNECTION_FORM_FIELDS: Record<string, ConnectionFormFieldDef[]> =
  {
    BIZIMHESAP: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
    PARASUT: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
      },
      { key: 'companyId', label: 'Şirket ID', type: 'text', required: true },
    ],
    LOGO: [
      {
        key: 'baseUrl',
        label: 'Sunucu URL',
        type: 'url',
        placeholder: 'http://192.168.1.10:8080',
        required: true,
        hint: 'Yerel sunucu için http:// veya https:// kullanabilirsiniz.',
      },
      { key: 'username', label: 'Kullanıcı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
      { key: 'firmNo', label: 'Firma No', type: 'text', required: true },
    ],
    MIKRO: [
      {
        key: 'baseUrl',
        label: 'Sunucu URL',
        type: 'url',
        placeholder: 'http://192.168.1.10',
        required: true,
        hint: 'http:// veya https:// ile tam adres girin.',
      },
      { key: 'username', label: 'Kullanıcı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
      { key: 'dbName', label: 'Veritabanı', type: 'text', required: true },
    ],
    NETSIS: [
      {
        key: 'baseUrl',
        label: 'Sunucu URL',
        type: 'url',
        placeholder: 'http://192.168.1.10',
        required: true,
        hint: 'http:// veya https:// ile tam adres girin.',
      },
      { key: 'username', label: 'Kullanıcı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
    ],
    LUCA: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'companyNo', label: 'Şirket No', type: 'text', required: true },
    ],
    ETA: [
      {
        key: 'baseUrl',
        label: 'Sunucu URL',
        type: 'url',
        placeholder: 'http://192.168.1.10:8080',
        required: true,
        hint: 'http:// veya https:// ile tam adres girin.',
      },
      { key: 'username', label: 'Kullanıcı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
    ],
    KOLAYBI: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
    ZIRVE: [
      {
        key: 'host',
        label: 'Sunucu',
        type: 'text',
        placeholder: '192.168.1.10',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        defaultValue: '8080',
      },
      { key: 'username', label: 'Kullanıcı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
    ],
    NEBIM: [
      {
        key: 'host',
        label: 'Sunucu',
        type: 'text',
        placeholder: '192.168.1.10',
        required: true,
      },
      { key: 'username', label: 'Kullanıcı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
    ],
    EBA: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
      },
      {
        key: 'apiBaseUrl',
        label: 'API URL',
        type: 'url',
        placeholder: 'https://api.ornek.com',
        required: true,
        hint: 'http:// veya https:// ile tam adres girin.',
      },
    ],
    SAP_B1: [
      {
        key: 'host',
        label: 'Sunucu',
        type: 'text',
        placeholder: '192.168.1.10',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        defaultValue: '50000',
      },
      { key: 'username', label: 'Kullanıcı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
      { key: 'companyDB', label: 'Şirket DB', type: 'text', required: true },
    ],
    ISNET: [
      {
        key: 'baseUrl',
        label: 'URL',
        type: 'url',
        placeholder: 'https://api.ornek.com',
        required: true,
        hint: 'http:// veya https:// ile tam adres girin.',
      },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
    TSOFT: [
      {
        key: 'storeUrl',
        label: 'Mağaza URL',
        type: 'url',
        placeholder: 'https://magaza.example.com',
        required: true,
        hint: 'http:// veya https:// ile tam adres girin.',
      },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
      },
    ],
    TICIMAX: [
      {
        key: 'storeUrl',
        label: 'Mağaza URL',
        type: 'url',
        placeholder: 'https://magaza.example.com',
        required: true,
        hint: 'http:// veya https:// ile tam adres girin.',
      },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  };

/** Prisma `Marketplace` enum sırasına yakın, UI listesi için */
export const MARKETPLACE_PLATFORM_IDS: string[] = [
  'TRENDYOL',
  'HEPSIBURADA',
  'N11',
  'CICEKSEPETI',
  'AMAZON_TR',
  'PTTAVM',
  'PAZARAMA',
  'GETIR',
  'GRATIS',
  'BOYNER',
  'MORHIPO',
  'DOLAP',
  'EBAY',
  'ETSY',
  'TEMU',
  'SAHIBINDEN',
];

export const ECOMMERCE_MARKETPLACE_IDS: string[] = [
  'TSOFT',
  'TICIMAX',
  'WOOCOMMERCE',
  'SHOPIFY',
  'IDEASOFT',
];

export const ERP_TYPE_IDS: string[] = [
  'BIZIMHESAP',
  'PARASUT',
  'LOGO',
  'MIKRO',
  'NETSIS',
  'LUCA',
  'ETA',
  'KOLAYBI',
  'ZIRVE',
  'NEBIM',
  'EBA',
  'SAP_B1',
  'ISNET',
  'TSOFT',
  'TICIMAX',
];

export function getMarketplaceFormFields(
  platform: string,
): ConnectionFormFieldDef[] {
  return MARKETPLACE_CONNECTION_FORM_FIELDS[platform] ?? [];
}

export function getErpFormFields(erpType: string): ConnectionFormFieldDef[] {
  return ERP_CONNECTION_FORM_FIELDS[erpType] ?? [];
}
