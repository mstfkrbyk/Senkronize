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

import { CacheKeys } from '../common/cache/cache-keys';

export const CURRENCY_LATEST_CACHE_KEY = CacheKeys.exchangeRates();
export const CURRENCY_LATEST_CACHE_TTL_SEC = 3_600;
