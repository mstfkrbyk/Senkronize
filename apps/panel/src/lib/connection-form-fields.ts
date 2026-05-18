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
  ALLEGRO: [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      type: 'password',
      required: true,
    },
    {
      key: 'scope',
      label: 'OAuth Scope (opsiyonel)',
      type: 'text',
      required: false,
      hint: 'Boş bırakılırsa Allegro varsayılan client_credentials kapsamı kullanılır.',
    },
    {
      key: 'accessToken',
      label: 'Access Token (opsiyonel, önbellek)',
      type: 'password',
      required: false,
    },
    {
      key: 'currency',
      label: 'Para birimi (fiyat için)',
      type: 'text',
      required: false,
      defaultValue: 'PLN',
    },
  ],
  WILDBERRIES: [
    { key: 'apiKey', label: 'API Key (Authorization)', type: 'password', required: true },
    {
      key: 'warehouseId',
      label: 'Depo ID (stok için)',
      type: 'text',
      required: true,
    },
    {
      key: 'currencyId',
      label: 'Para birimi ID (fiyat, örn. 643)',
      type: 'text',
      required: false,
      defaultValue: '643',
    },
  ],
  OZON: [
    { key: 'clientId', label: 'Client-Id', type: 'text', required: true },
    { key: 'apiKey', label: 'Api-Key', type: 'password', required: true },
    {
      key: 'warehouseId',
      label: 'Depo ID (stok için, sayı)',
      type: 'text',
      required: true,
    },
  ],
  NOON: [{ key: 'apiKey', label: 'Api-Key', type: 'password', required: true }],
  AMAZON_EU: [
    { key: 'sellerId', label: 'Satıcı ID', type: 'text', required: true },
    { key: 'clientId', label: 'LWA Client ID', type: 'text', required: true },
    {
      key: 'clientSecret',
      label: 'LWA Client Secret',
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
      label: 'Marketplace ID (DE/FR/UK/IT/ES)',
      type: 'text',
      required: true,
      hint: 'Örn. DE: A1PA6795UKMFR9, UK: A1F83G8C2ARO7P',
    },
    {
      key: 'currency',
      label: 'Para birimi (opsiyonel, örn. EUR)',
      type: 'text',
      required: false,
    },
  ],
  CDISCOUNT: [
    {
      key: 'apiLogin',
      label: 'API Login',
      type: 'text',
      required: true,
    },
    {
      key: 'apiPassword',
      label: 'API Password',
      type: 'password',
      required: true,
    },
  ],
  KAUFLAND: [
    { key: 'accessKey', label: 'Access Key (Shop-Client-Key)', type: 'text', required: true },
    {
      key: 'secretKey',
      label: 'Secret Key',
      type: 'password',
      required: true,
    },
  ],
  TRENDYOL_GO: [
    {
      key: 'supplierId',
      label: 'Tedarikçi / Mağaza ID',
      type: 'text',
      required: false,
      hint: 'Aynı SKU için farklı kanal ayırımı varsa doldurun.',
    },
    { key: 'apiKey', label: 'API Key (Basic kullanıcı)', type: 'text', required: true },
    {
      key: 'apiSecret',
      label: 'API Secret (Basic şifre)',
      type: 'password',
      required: true,
    },
    {
      key: 'channelId',
      label: 'Satış kanalı ID (opsiyonel)',
      type: 'text',
      required: false,
      hint: 'Aynı SKU, farklı kanal stokları için platform dokümantasyonuna göre.',
    },
  ],
  BANABI: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  A101: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
  ],
  ELEKTRA: [
    {
      key: 'accessToken',
      label: 'Bearer Token',
      type: 'password',
      required: true,
    },
  ],
  ARCELIK: [
    { key: 'clientId', label: 'OAuth2 Client ID', type: 'text', required: true },
    {
      key: 'clientSecret',
      label: 'OAuth2 Client Secret',
      type: 'password',
      required: true,
    },
    {
      key: 'accessToken',
      label: 'Access Token (opsiyonel, sabit token)',
      type: 'password',
      required: false,
      hint: 'Doluysa client credentials yerine doğrudan kullanılır.',
    },
  ],
  VESTEL: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  BIMAKILLI: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  MIGROSHEMEN: [
    {
      key: 'accessToken',
      label: 'Bearer Token',
      type: 'password',
      required: true,
    },
  ],
  ROBOMARKT: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  SHOPIGO: [
    {
      key: 'accessToken',
      label: 'Bearer Token',
      type: 'password',
      required: true,
    },
  ],
  YEMEKSEPETI: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
  ],
  GETIR_FOOD: [
    {
      key: 'accessToken',
      label: 'Bearer Token',
      type: 'password',
      required: true,
    },
  ],
  TRENDYOL_YEMEK: [
    {
      key: 'apiKey',
      label: 'API Key (Basic kullanıcı)',
      type: 'text',
      required: true,
    },
    {
      key: 'apiSecret',
      label: 'API Secret (Basic şifre)',
      type: 'password',
      required: true,
    },
    {
      key: 'supplierId',
      label: 'Tedarikçi ID (opsiyonel)',
      type: 'text',
      required: false,
    },
  ],
  FUUDY: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  MODANISA: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'sellerId', label: 'Satıcı ID', type: 'text', required: true },
  ],
  SEFAMERVE: [
    {
      key: 'accessToken',
      label: 'Bearer Token',
      type: 'password',
      required: true,
    },
  ],
  LIDYANA: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  ADDAX: [
    {
      key: 'accessToken',
      label: 'Bearer Token',
      type: 'password',
      required: true,
    },
  ],
  VIVENSE: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  CICEKSEPETI_EV: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'sellerId', label: 'Satıcı ID', type: 'text', required: true },
    {
      key: 'categoryId',
      label: 'Ev & yaşam kategori / kanal ID',
      type: 'text',
      required: false,
      hint: 'Çiçeksepeti API ile aynı uçlar; sipariş ve ürün listelerinde filtre için.',
    },
  ],
  EVIDEA: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  PORLAND: [
    { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
    { key: 'password', label: 'Şifre', type: 'password', required: true },
  ],
  ALIBABA: [
    { key: 'appKey', label: 'App Key', type: 'text', required: true },
    { key: 'appSecret', label: 'App Secret', type: 'password', required: true },
    {
      key: 'sessionKey',
      label: 'Session Key (OAuth2)',
      type: 'password',
      required: true,
    },
  ],
  MADEINCHINA: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  EXPORTIFY: [
    {
      key: 'accessToken',
      label: 'Bearer Token',
      type: 'password',
      required: true,
    },
  ],
  GITTIGIDIYOR: [
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
    {
      key: 'accessToken',
      label: 'Access Token (opsiyonel)',
      type: 'password',
      required: false,
    },
  ],
  KITAPYURDU: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  DR: [
    {
      key: 'accessToken',
      label: 'Bearer Token',
      type: 'password',
      required: true,
    },
  ],
  SPORTIVE: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  ENPARA: [
    { key: 'clientId', label: 'OAuth2 Client ID', type: 'text', required: true },
    {
      key: 'clientSecret',
      label: 'OAuth2 Client Secret',
      type: 'password',
      required: true,
    },
    {
      key: 'accessToken',
      label: 'Access Token (Bearer)',
      type: 'password',
      required: true,
      hint: 'Client credentials veya yetkilendirme akışıyla alınan token.',
    },
  ],
  LAZADA: [
    { key: 'appKey', label: 'App Key', type: 'text', required: true },
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'password',
      required: true,
    },
  ],
  SHOPEE: [
    { key: 'partnerId', label: 'Partner ID', type: 'text', required: true },
    {
      key: 'partnerKey',
      label: 'Partner Key (gizli)',
      type: 'password',
      required: true,
    },
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'password',
      required: true,
    },
    { key: 'shopId', label: 'Shop ID', type: 'text', required: true },
  ],
  TOKOPEDIA: [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      type: 'password',
      required: true,
    },
    {
      key: 'accessToken',
      label: 'Access Token (Bearer)',
      type: 'password',
      required: true,
      hint: 'OAuth2 client credentials ile alınan token.',
    },
  ],
  MEESHO: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
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
  'AMAZON_EU',
  'ALLEGRO',
  'WILDBERRIES',
  'OZON',
  'NOON',
  'CDISCOUNT',
  'KAUFLAND',
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
  'TRENDYOL_GO',
  'BANABI',
  'A101',
  'ELEKTRA',
  'ARCELIK',
  'VESTEL',
  'BIMAKILLI',
  'MIGROSHEMEN',
  'ROBOMARKT',
  'SHOPIGO',
  'YEMEKSEPETI',
  'GETIR_FOOD',
  'TRENDYOL_YEMEK',
  'FUUDY',
  'MODANISA',
  'SEFAMERVE',
  'LIDYANA',
  'ADDAX',
  'VIVENSE',
  'CICEKSEPETI_EV',
  'EVIDEA',
  'PORLAND',
  'ALIBABA',
  'MADEINCHINA',
  'EXPORTIFY',
  'GITTIGIDIYOR',
  'KITAPYURDU',
  'DR',
  'SPORTIVE',
  'ENPARA',
  'LAZADA',
  'SHOPEE',
  'TOKOPEDIA',
  'MEESHO',
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
