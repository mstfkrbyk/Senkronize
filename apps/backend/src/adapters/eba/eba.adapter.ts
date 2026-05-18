import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { EBA_DEFAULT_API_BASE, EBA_DEFAULT_TOKEN_PATH } from './eba.constants';
import type { EbaInvoiceCreateResponse, EbaTokenResponse } from './eba.types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function resolveApiBase(credentials: Record<string, string>): string {
  const raw = credentials.apiBaseUrl?.trim();
  return raw ? normalizeBaseUrl(raw) : EBA_DEFAULT_API_BASE;
}

function resolveTokenUrl(credentials: Record<string, string>): string {
  const explicit = credentials.oauthTokenUrl?.trim();
  if (explicit) {
    return explicit;
  }
  return `${resolveApiBase(credentials)}${EBA_DEFAULT_TOKEN_PATH}`;
}

function pickInvoiceMeta(data: unknown): { id: string; number: string } {
  if (!isRecord(data)) {
    return { id: 'unknown', number: 'unknown' };
  }
  const num =
    (typeof data.invoiceNumber === 'string' && data.invoiceNumber) ||
    (typeof data.number === 'string' && data.number) ||
    '';
  const id =
    (typeof data.id === 'string' && data.id) ||
    (typeof data.documentId === 'string' && data.documentId) ||
    num ||
    'unknown';
  return { id, number: num || id };
}

function normalizeItemsPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (isRecord(data)) {
    if (Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data.data)) {
      return data.data;
    }
  }
  return [];
}

interface CachedEbaToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class EbaAdapter implements IErpAdapter {
  readonly erpType = 'EBA';
  private readonly logger = new Logger(EbaAdapter.name);
  private readonly tokenCache = new Map<string, CachedEbaToken>();

  private cacheKey(credentials: Record<string, string>): string {
    return `${resolveTokenUrl(credentials)}\0${credentials.clientId ?? ''}`;
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const clientId = credentials.clientId;
    const clientSecret = credentials.clientSecret;
    if (!clientId || !clientSecret) {
      throw new Error('eBA: clientId ve clientSecret zorunludur');
    }
    const key = this.cacheKey(credentials);
    const now = Date.now();
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAt > now + 5000) {
      return cached.accessToken;
    }
    const tokenUrl = resolveTokenUrl(credentials);
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });
    const data = await axiosWithRetry<EbaTokenResponse>(
      {
        method: 'POST',
        url: tokenUrl,
        data: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15_000,
      },
      { maxRetries: 2 },
    );
    const expiresIn =
      typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
        ? data.expires_in
        : 3600;
    this.tokenCache.set(key, {
      accessToken: data.access_token,
      expiresAt: now + expiresIn * 1000 - 60_000,
    });
    return data.access_token;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const token = await this.getAccessToken(credentials);
      const apiBase = resolveApiBase(credentials);
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${apiBase}/inventory/items`,
          params: { limit: 1 },
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15_000,
        },
        { maxRetries: 2 },
      );
      return true;
    } catch (error) {
      this.logger.warn('eBA bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const token = await this.getAccessToken(credentials);
      const apiBase = resolveApiBase(credentials);
      const data = await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${apiBase}/inventory/items`,
          params: { limit: 500, offset: 0 },
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        },
        { maxRetries: 2 },
      );
      const raw = normalizeItemsPayload(data);
      return raw.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const codeRaw = p.code ?? p.itemCode ?? p.sku;
        const code =
          typeof codeRaw === 'string'
            ? codeRaw.trim()
            : typeof codeRaw === 'number' && Number.isFinite(codeRaw)
              ? String(codeRaw)
              : `row-${i}`;
        const barcodeRaw = p.barcode ?? p.code ?? code;
        const barcode =
          typeof barcodeRaw === 'string'
            ? barcodeRaw.trim()
            : typeof barcodeRaw === 'number' && Number.isFinite(barcodeRaw)
              ? String(barcodeRaw)
              : code;
        const nameRaw = p.name ?? p.description ?? code;
        const name =
          typeof nameRaw === 'string' ? nameRaw.trim() || code : String(nameRaw);
        const stockRaw = p.stock ?? p.stockQuantity ?? 0;
        const purchaseRaw = p.purchasePrice ?? p.cost;
        const purchasePrice =
          purchaseRaw !== undefined && purchaseRaw !== null
            ? Number(purchaseRaw)
            : undefined;
        return {
          erpProductId: code,
          barcode,
          name,
          stockQuantity: Math.max(0, Math.round(Number(stockRaw))),
          ...(Number.isFinite(purchasePrice) ? { purchasePrice } : {}),
        };
      });
    } catch (error) {
      this.logger.warn('eBA ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const token = await this.getAccessToken(credentials);
    const apiBase = resolveApiBase(credentials);
    const today = new Date().toISOString().split('T')[0];
    const data = await axiosWithRetry<EbaInvoiceCreateResponse>(
      {
        method: 'POST',
        url: `${apiBase}/documents/invoices`,
        data: {
          reference: invoice.orderRef,
          currency: invoice.currency,
          totalAmount: invoice.totalAmount,
          issueDate: today,
          triggerApprovalFlow: credentials.triggerApprovalFlow === 'true',
          lines: invoice.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            lineTotal: l.total,
          })),
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
    const meta = pickInvoiceMeta(data as unknown);
    return {
      erpInvoiceId: meta.id,
      orderRef: invoice.orderRef,
      invoiceNumber: meta.number,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      issuedAt: today,
      lines: invoice.lines,
    };
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}
