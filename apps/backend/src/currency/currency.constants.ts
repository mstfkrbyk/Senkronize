/** ISO 4217 — TCMB today.xml ile uyumlu kodlar */
export const SUPPORTED_CURRENCIES = [
  'TRY',
  'USD',
  'EUR',
  'GBP',
  'SAR',
  'AED',
  'PLN',
  'RON',
  'HUF',
  'CZK',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const TCMB_TODAY_XML = 'https://www.tcmb.gov.tr/kurlar/today.xml';

export const CURRENCY_LATEST_CACHE_KEY = 'currency:tcmb:latest';
export const CURRENCY_LATEST_CACHE_TTL_SEC = 86_400;
