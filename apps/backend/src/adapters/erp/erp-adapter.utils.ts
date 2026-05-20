import type { ERPConnectionResult, ErpInvoice, ErpProduct } from '@senkronize/shared';
import axios from 'axios';

import { axiosWithRetry } from '../../common/utils/http-retry';

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function normalizeArrayPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (isRecord(data)) {
    if (Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data.value)) {
      return data.value;
    }
    if (Array.isArray(data.data)) {
      return data.data;
    }
    if (Array.isArray(data.results)) {
      return data.results;
    }
    if (Array.isArray(data.records)) {
      return data.records;
    }
  }
  return [];
}

export function mapRowsToErpProducts(
  rows: unknown[],
  pick: (row: Record<string, unknown>, index: number) => ErpProduct,
): ErpProduct[] {
  return rows.map((row, i) => {
    const p = isRecord(row) ? row : {};
    return pick(p, i);
  });
}

interface OAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getOAuth2ClientCredentialsToken(
  cacheKey: string,
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  scope?: string,
): Promise<string> {
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 5000) {
    return cached.token;
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (scope) {
    body.set('scope', scope);
  }
  const data = await axiosWithRetry<OAuthTokenResponse>(
    {
      method: 'POST',
      url: tokenUrl,
      data: body.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20_000,
    },
    { maxRetries: 2 },
  );
  const token = data.access_token ?? '';
  if (!token) {
    throw new Error('OAuth2: access_token alınamadı');
  }
  const ttlSec =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 3600;
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + ttlSec * 1000 - 60_000,
  });
  return token;
}

export interface JsonApiResource {
  id: string;
  type?: string;
  attributes: Record<string, unknown>;
}

export interface JsonApiResponse {
  data: JsonApiResource | JsonApiResource[];
  meta?: Record<string, unknown>;
}

export function parseJsonApi<T extends object>(
  response: JsonApiResponse,
): Array<T & { id: string }> {
  const rows = Array.isArray(response.data) ? response.data : [response.data];
  return rows.map((item) => ({
    id: item.id,
    ...(item.attributes as T),
  }));
}

export function formatErpConnectionError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    let detail = '';
    if (typeof data === 'string' && data.length > 0) {
      detail = data.slice(0, 180).replace(/\s+/g, ' ');
    } else if (isRecord(data)) {
      const msg =
        (typeof data.message === 'string' && data.message) ||
        (typeof data.error === 'string' && data.error) ||
        (typeof data.title === 'string' && data.title) ||
        '';
      if (msg) {
        detail = msg.slice(0, 180);
      }
    }
    if (status) {
      return detail.length > 0
        ? `HTTP ${status}: ${detail}`
        : `HTTP ${status}: istek başarısız`;
    }
    if (error.code === 'ECONNREFUSED') {
      return 'Sunucuya bağlanılamadı (bağlantı reddedildi)';
    }
    if (error.code === 'ENOTFOUND') {
      return 'Sunucu adresi çözümlenemedi';
    }
    return error.message || 'Bağlantı testi başarısız';
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Bağlantı testi başarısız';
}

export async function runErpConnectionTest(
  fn: () => Promise<{
    productCount?: number;
    companyName?: string;
    version?: string;
  }>,
): Promise<ERPConnectionResult> {
  const started = Date.now();
  try {
    const meta = await fn();
    return {
      success: true,
      responseTimeMs: Date.now() - started,
      ...meta,
    };
  } catch (error) {
    return {
      success: false,
      responseTimeMs: Date.now() - started,
      message: formatErpConnectionError(error),
    };
  }
}

export function stubInvoice(
  invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
): ErpInvoice {
  const today = new Date().toISOString().split('T')[0];
  return {
    erpInvoiceId: 'pending',
    orderRef: invoice.orderRef,
    invoiceNumber: invoice.orderRef,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency,
    issuedAt: today,
    lines: invoice.lines,
  };
}
