import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { LOGO_API_PATH } from './logo.constants';
import type {
  LogoInvoiceCreateResponse,
  LogoItemsResponse,
  LogoTokenResponse,
} from './logo.types';

interface CachedToken {
  token: string;
  expiresAt: number;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickInvoiceMeta(data: unknown): { id: string; number: string } {
  if (!isRecord(data)) {
    return { id: 'unknown', number: 'unknown' };
  }
  const num =
    (typeof data.invoiceNumber === 'string' && data.invoiceNumber) ||
    (typeof data.number === 'string' && data.number) ||
    (typeof data.invoiceNo === 'string' && data.invoiceNo) ||
    '';
  const id =
    (typeof data.id === 'string' && data.id) ||
    (typeof data.invoiceId === 'string' && data.invoiceId) ||
    num ||
    'unknown';
  return { id, number: num || id };
}

@Injectable()
export class LogoAdapter implements IErpAdapter {
  readonly erpType = 'LOGO';
  private readonly logger = new Logger(LogoAdapter.name);
  private readonly tokenCache = new Map<string, CachedToken>();

  private cacheKey(credentials: Record<string, string>): string {
    const base = normalizeBaseUrl(credentials.baseUrl ?? '');
    return `${base}\0${credentials.username ?? ''}\0${credentials.firmNo ?? ''}\0${credentials.periodNo ?? ''}`;
  }

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    const username = credentials.username;
    const password = credentials.password;
    const firmNo = credentials.firmNo;
    const periodNo = credentials.periodNo;
    if (!baseUrl || !username || !password || !firmNo || !periodNo) {
      throw new Error('Logo: baseUrl, username, password, firmNo ve periodNo zorunludur');
    }
    const key = this.cacheKey(credentials);
    const cached = this.tokenCache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now + 5000) {
      return cached.token;
    }
    const { data } = await axios.post<LogoTokenResponse>(
      `${baseUrl}${LOGO_API_PATH}/token`,
      {
        userName: username,
        password,
        firmNo,
        periodNo,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    let expiresAt = now + 3600_000;
    if (data.expiresAt) {
      const parsed = Date.parse(data.expiresAt);
      if (!Number.isNaN(parsed)) {
        expiresAt = parsed;
      }
    }
    this.tokenCache.set(key, { token: data.token, expiresAt });
    return data.token;
  }

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    if (!baseUrl) {
      throw new Error('Logo: baseUrl zorunludur');
    }
    const token = await this.getToken(credentials);
    return axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.getToken(credentials);
      return true;
    } catch (error) {
      this.logger.warn('Logo bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const client = await this.getClient(credentials);
      const { data } = await client.get<LogoItemsResponse>(`${LOGO_API_PATH}/items`, {
        params: { limit: 500, offset: 0 },
      });
      const items = data.items ?? [];
      return items.map((p, i) => {
        const code = (p.code ?? '').trim() || `row-${i}`;
        return {
          erpProductId: code,
          barcode: (p.barcode ?? p.code ?? code).trim(),
          name: (p.description ?? code).trim() || code,
          stockQuantity: Math.max(0, Math.round(Number(p.stockQty ?? 0))),
          purchasePrice: p.salesPrice,
        };
      });
    } catch (error) {
      this.logger.warn('Logo ürün listesi alınamadı (stub/yol uyumsuz olabilir)', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = await this.getClient(credentials);
    const today = new Date().toISOString().split('T')[0];
    const body = {
      reference: invoice.orderRef,
      currency: invoice.currency,
      totalAmount: invoice.totalAmount,
      issueDate: today,
      lines: invoice.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        lineTotal: l.total,
      })),
    };
    const { data } = await client.post<LogoInvoiceCreateResponse>(
      `${LOGO_API_PATH}/invoices`,
      body,
    );
    const meta = pickInvoiceMeta(data);
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
