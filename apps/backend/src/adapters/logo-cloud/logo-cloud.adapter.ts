import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

const LOGO_CLOUD_BASE = 'https://cloud.logo.com.tr/api/v1';

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class LogoCloudAdapter implements IErpAdapter {
  readonly erpType = 'LOGO_CLOUD';
  private readonly logger = new Logger(LogoCloudAdapter.name);
  private readonly tokenCache = new Map<string, CachedToken>();

  private base(credentials: Record<string, string>): string {
    return (credentials.baseUrl?.trim() || LOGO_CLOUD_BASE).replace(/\/+$/, '');
  }

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('Logo Cloud: clientId ve clientSecret zorunludur');
    }
    const root = this.base(credentials);
    const cacheKey = `${root}\0${clientId}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
    const { data } = await axios.post<{
      access_token?: string;
      expires_in?: number;
    }>(
      `${root}/oauth/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15_000,
      },
    );
    const token = data.access_token ?? '';
    if (!token) {
      throw new Error('Logo Cloud: access_token alınamadı');
    }
    const ttlSec =
      typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
        ? data.expires_in
        : 3600;
    this.tokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + ttlSec * 1000 - 60_000,
    });
    return token;
  }

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const token = await this.getToken(credentials);
    return axios.create({
      baseURL: this.base(credentials),
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
      const client = await this.getClient(credentials);
      await client.get('/me', { timeout: 12_000 });
      return true;
    } catch {
      try {
        const client = await this.getClient(credentials);
        await client.get('/items', { params: { limit: 1 }, timeout: 12_000 });
        return true;
      } catch (error) {
        this.logger.warn('Logo Cloud bağlantı testi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        return false;
      }
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const client = await this.getClient(credentials);
      const { data } = await client.get<unknown>('/items', {
        params: { limit: 500 },
      });
      const raw = Array.isArray(data)
        ? data
        : typeof data === 'object' &&
            data !== null &&
            'items' in data &&
            Array.isArray((data as { items: unknown[] }).items)
          ? (data as { items: unknown[] }).items
          : [];
      return raw.map((row: unknown, i: number) => {
        const p =
          typeof row === 'object' && row !== null
            ? (row as Record<string, unknown>)
            : {};
        const code = String(p.id ?? p.code ?? `row-${i}`);
        return {
          erpProductId: code,
          barcode: String(p.barcode ?? p.sku ?? code),
          name: String(p.name ?? code),
          stockQuantity: Math.max(
            0,
            Math.round(Number(p.stock ?? p.quantity ?? 0)),
          ),
        };
      });
    } catch (error) {
      this.logger.warn('Logo Cloud ürün listesi alınamadı', {
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
    const { data } = await client.post<{ id?: string; number?: string }>(
      '/invoices',
      {
        reference: invoice.orderRef,
        currency: invoice.currency,
        totalAmount: invoice.totalAmount,
        lines: invoice.lines,
      },
    );
    const id = String(data.id ?? 'unknown');
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: String(data.number ?? id),
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
