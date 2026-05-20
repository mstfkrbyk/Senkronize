export const AMAZON_LWA_URL = 'https://api.amazon.com/auth/o2/token';
export const AMAZON_SP_BASE_URL = 'https://sellingpartnerapi-eu.amazon.com';
export const AMAZON_SP_EU_BASE_URL = 'https://sellingpartnerapi-eu.amazon.com';
export const AMAZON_SP_NA_BASE_URL = 'https://sellingpartnerapi-na.amazon.com';
export const AMAZON_SP_FE_BASE_URL = 'https://sellingpartnerapi-fe.amazon.com';
export const AMAZON_TR_MARKETPLACE_ID = 'A33AVAJ2PDY3EV';
export const AMAZON_US_MARKETPLACE_ID = 'ATVPDKIKX0DER';

export const AMAZON_SP_AWS_REGION_EU = 'eu-west-1';
export const AMAZON_SP_AWS_REGION_NA = 'us-east-1';
export const AMAZON_SP_AWS_REGION_FE = 'us-west-2';

/** Satış raporu — tüm siparişler (son güncellemeye göre) */
export const AMAZON_REPORT_TYPE_ALL_ORDERS =
  'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_LAST_UPDATE_GENERAL';

/** Amazon SP-API bölgesel pazar yeri kimlikleri (17. tur) */
export const AMAZON_GLOBAL_MARKETPLACE_IDS = {
  UK: 'A1F83G8C2ARO7P',
  DE: 'A1PA6795UKMFR9',
  FR: 'A13V1IB3VIYZZH',
  CA: 'A2EUQ1WTGCTBG2',
  JP: 'A1VC38T7YXB528',
  US: AMAZON_US_MARKETPLACE_ID,
} as const;

export interface AmazonMarketplaceConfig {
  spBaseUrl: string;
  marketplaceId: string;
  defaultCurrency: string;
  awsRegion: string;
}

/** SP-API endpoint + marketplaceId + imza bölgesi */
export const AMAZON_MARKETPLACE_CONFIG: Record<string, AmazonMarketplaceConfig> = {
  TR: {
    spBaseUrl: AMAZON_SP_EU_BASE_URL,
    marketplaceId: AMAZON_TR_MARKETPLACE_ID,
    defaultCurrency: 'TRY',
    awsRegion: AMAZON_SP_AWS_REGION_EU,
  },
  DE: {
    spBaseUrl: AMAZON_SP_EU_BASE_URL,
    marketplaceId: AMAZON_GLOBAL_MARKETPLACE_IDS.DE,
    defaultCurrency: 'EUR',
    awsRegion: AMAZON_SP_AWS_REGION_EU,
  },
  UK: {
    spBaseUrl: AMAZON_SP_EU_BASE_URL,
    marketplaceId: AMAZON_GLOBAL_MARKETPLACE_IDS.UK,
    defaultCurrency: 'GBP',
    awsRegion: AMAZON_SP_AWS_REGION_EU,
  },
  US: {
    spBaseUrl: AMAZON_SP_NA_BASE_URL,
    marketplaceId: AMAZON_US_MARKETPLACE_ID,
    defaultCurrency: 'USD',
    awsRegion: AMAZON_SP_AWS_REGION_NA,
  },
};

export const AMAZON_GLOBAL_MARKETPLACE_CURRENCY: Record<string, string> = {
  [AMAZON_GLOBAL_MARKETPLACE_IDS.UK]: 'GBP',
  [AMAZON_GLOBAL_MARKETPLACE_IDS.DE]: 'EUR',
  [AMAZON_GLOBAL_MARKETPLACE_IDS.FR]: 'EUR',
  [AMAZON_GLOBAL_MARKETPLACE_IDS.CA]: 'CAD',
  [AMAZON_GLOBAL_MARKETPLACE_IDS.JP]: 'JPY',
  [AMAZON_GLOBAL_MARKETPLACE_IDS.US]: 'USD',
};
