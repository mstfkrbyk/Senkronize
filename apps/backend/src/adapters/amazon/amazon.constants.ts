export const AMAZON_LWA_URL = 'https://api.amazon.com/auth/o2/token';
export const AMAZON_SP_BASE_URL = 'https://sellingpartnerapi-eu.amazon.com';
export const AMAZON_SP_EU_BASE_URL = 'https://sellingpartnerapi-eu.amazon.com';
export const AMAZON_SP_NA_BASE_URL = 'https://sellingpartnerapi-na.amazon.com';
export const AMAZON_SP_FE_BASE_URL = 'https://sellingpartnerapi-fe.amazon.com';
export const AMAZON_TR_MARKETPLACE_ID = 'A33AVAJ2PDY3EV';

/** Amazon SP-API bölgesel pazar yeri kimlikleri (17. tur) */
export const AMAZON_GLOBAL_MARKETPLACE_IDS = {
  UK: 'A1F83G8C2ARO7P',
  DE: 'A1PA6795UKMFR9',
  FR: 'A13V1IB3VIYZZH',
  CA: 'A2EUQ1WTGCTBG2',
  JP: 'A1VC38T7YXB528',
} as const;

export const AMAZON_GLOBAL_MARKETPLACE_CURRENCY: Record<string, string> = {
  [AMAZON_GLOBAL_MARKETPLACE_IDS.UK]: 'GBP',
  [AMAZON_GLOBAL_MARKETPLACE_IDS.DE]: 'EUR',
  [AMAZON_GLOBAL_MARKETPLACE_IDS.FR]: 'EUR',
  [AMAZON_GLOBAL_MARKETPLACE_IDS.CA]: 'CAD',
  [AMAZON_GLOBAL_MARKETPLACE_IDS.JP]: 'JPY',
};
