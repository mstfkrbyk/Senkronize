import { Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const logger = new Logger('HttpRetry');

export interface RetryOptions {
  maxRetries?: number; // Varsayılan: 3
  backoffMs?: number; // Varsayılan: 1000 (exponential: 1s, 2s, 4s)
  retryOn?: number[]; // HTTP status kodları (varsayılan: [429, 500, 502, 503, 504])
  onRetry?: (attempt: number, error: Error) => void;
}

export async function axiosWithRetry<T>(
  config: AxiosRequestConfig,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    backoffMs = 1000,
    retryOn = [429, 500, 502, 503, 504],
  } = options;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await axios(config);
      return response.data as T;
    } catch (err) {
      const error = err as AxiosError;
      const status = error.response?.status;
      const isLastAttempt = attempt > maxRetries;

      if (isLastAttempt || (status && !retryOn.includes(status))) {
        throw err;
      }

      const retryAfterHeader = error.response?.headers?.['retry-after'];
      let waitMs = backoffMs * Math.pow(2, attempt - 1);
      if (retryAfterHeader !== undefined) {
        const raw = Array.isArray(retryAfterHeader)
          ? retryAfterHeader[0]
          : retryAfterHeader;
        const parsed = parseInt(String(raw), 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          waitMs = parsed * 1000;
        }
      }

      logger.warn(
        `HTTP ${String(status)} → ${String(attempt)}. deneme sonrası ${String(waitMs)}ms bekleniyor`,
      );
      options.onRetry?.(attempt, error);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error('Max retry exceeded');
}

type RateLimiterState = { tokens: number; lastTs: number };

// Rate limit per platform (basit in-memory token bucket)
const rateLimiters = new Map<string, RateLimiterState>();

export async function withRateLimit<T = void>(
  platform: string,
  requestsPerMinute: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const prev = rateLimiters.get(platform) ?? {
    tokens: requestsPerMinute,
    lastTs: now,
  };
  const elapsedMin = (now - prev.lastTs) / 60_000;
  let tokens = Math.min(
    requestsPerMinute,
    prev.tokens + elapsedMin * requestsPerMinute,
  );
  let lastTs = now;

  if (tokens < 1) {
    const need = 1 - tokens;
    const waitMs = (need / requestsPerMinute) * 60_000;
    logger.warn(
      `${platform} rate limit → ${String(Math.ceil(waitMs / 1000))}s bekleniyor`,
    );
    await new Promise((r) => setTimeout(r, waitMs));
    tokens = 1;
    lastTs = Date.now();
  }

  tokens -= 1;
  rateLimiters.set(platform, { tokens, lastTs });
  return await fn();
}

// Platform bazlı rate limit konfigürasyonu (istek / dakika)
export const PLATFORM_RATE_LIMITS: Record<string, number> = {
  TRENDYOL: 60,
  HEPSIBURADA: 200,
  N11: 30,
  CICEKSEPETI: 60,
  AMAZON_TR: 60,
  PTTAVM: 30,
  PAZARAMA: 60,
  WOOCOMMERCE: 120,
  SHOPIFY: 40,
  IDEASOFT: 60,
  TSOFT: 60,
  TICIMAX: 60,
  GETIR: 45,
  GRATIS: 40,
  BOYNER: 30,
  MORHIPO: 35,
  DOLAP: 40,
  EBAY: 50,
  ETSY: 40,
  TEMU: 20,
  SAHIBINDEN: 30,
  MIGROS: 40,
  HEPSIEXPRESS: 60,
  FLO: 35,
  DEFACTO: 35,
  LCWAIKIKI: 40,
  VATAN: 35,
  MEDIAMARKT: 35,
  TEKNOSA: 40,
  KOTON: 35,
  MAVI: 35,
  MAGENTO: 60,
  PRESTASHOP: 40,
  OPENCART: 60,
  FAPRIKA: 40,
  UNIPOS: 40,
  AKINON: 40,
  IKAS: 40,
  ALLEGRO: 90,
  WILDBERRIES: 60,
  OZON: 40,
  NOON: 45,
  AMAZON_EU: 60,
  CDISCOUNT: 30,
  KAUFLAND: 60,
  TRENDYOL_GO: 60,
  BANABI: 40,
  A101: 40,
  ELEKTRA: 35,
  ARCELIK: 40,
  VESTEL: 35,
  BIMAKILLI: 40,
  MIGROSHEMEN: 45,
  ROBOMARKT: 35,
  SHOPIGO: 35,
  YEMEKSEPETI: 40,
  GETIR_FOOD: 45,
  TRENDYOL_YEMEK: 60,
  FUUDY: 40,
  MODANISA: 35,
  SEFAMERVE: 40,
  LIDYANA: 40,
  ADDAX: 40,
  VIVENSE: 35,
  CICEKSEPETI_EV: 60,
  EVIDEA: 40,
  PORLAND: 30,
  ALIBABA: 40,
  MADEINCHINA: 40,
  EXPORTIFY: 40,
  GITTIGIDIYOR: 50,
  KITAPYURDU: 40,
  DR: 40,
  SPORTIVE: 40,
  ENPARA: 40,
  LAZADA: 40,
  SHOPEE: 40,
  TOKOPEDIA: 40,
  MEESHO: 40,
  OTTO: 40,
  ZALANDO: 45,
  BOLCOM: 40,
  EMAG: 35,
  IDEALO: 40,
  REALDE: 40,
  ZARA: 40,
  DECATHLON: 40,
  HEPSIBURADA_PREMIUM: 200,
  TRENDYOL_PREMIUM: 60,
  PAZARAMA_PREMIUM: 60,
  N11_PRO: 30,
  AMAZON_AE: 60,
  NAMSHI: 40,
  CARREFOUR_ME: 40,
  JUMIA: 35,
  DARAZ: 40,
  FLIPKART: 40,
  SNAPDEAL: 40,
  MYNTRA: 40,
  RAKUTEN: 45,
  QOO10: 40,
  LAZADA_PH: 40,
  MERCADOLIBRE: 50,
  GETIR_YEMEK: 45,
  LETGO: 40,
  SAHIBINDEN_PRO: 35,
  SHOPIVERSE: 40,
  WALMART: 45,
  TARGET_PLUS: 40,
  BESTBUY: 40,
  WAYFAIR: 40,
  OVERSTOCK: 40,
  FNAC: 40,
  LAREDOUTE: 40,
  SPARTOO: 40,
  MANOMANO: 40,
  VEEPEE: 40,
  TRENDYOL_INT: 60,
  MIGROS_SANAL: 45,
  CARREFOURSA: 40,
  BIM_ONLINE: 40,
  SOK_MARKET: 40,
  TAZE_DIREKT: 40,
  GORILLAS: 45,
  INSTACART: 45,
  ALIBABA_TR: 40,
  TRENDYOL_MILLA: 60,
  SAHIBINDEN_PREMIUM: 35,
  BUKALAPAK: 40,
  JDID: 40,
  BLIBLI: 40,
  TIKI: 40,
  SENDO: 40,
  CATCH_AU: 40,
  MYDEAL: 40,
  TRADEME: 40,
  LAMODA: 40,
  YANDEX_MARKET: 40,
  SHOPIROLL: 40,
  MEDUSA: 60,
  VENDURE: 40,
  SALEOR: 40,
  IYZICO: 30,
  STRIPE: 80,
  DEFAULT: 30,
};
