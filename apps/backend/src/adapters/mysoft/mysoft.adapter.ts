import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import type {
  MysoftLoginResponse,
  MysoftProductsResponse,
} from './mysoft.types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

@Injectable()
export class MysoftAdapter implements IErpAdapter {
  readonly erpType = 'MYSOFT';
  private readonly logger = new Logger(MysoftAdapter.name);
  private readonly sessionCache = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  private base(credentials: Record<string, string>): string {
    return normalizeBaseUrl(credentials.baseUrl ?? 'https://api.mysoft.com.tr');
  }

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    const licenseKey = credentials.licenseKey?.trim();
    if (!username || !password || !licenseKey) {
      throw new Error('Mysoft: username, password ve licenseKey zorunludur');
    }
    const root = this.base(credentials);
    const cacheKey = `${root}\0${username}\0${licenseKey}`;
    const cached = this.sessionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
    const { data } = await axios.post<MysoftLoginResponse>(
      `${root}/auth/login`,
      { username, password, licenseKey },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    const token = data.accessToken ?? data.token ?? '';
    if (!token) {
      throw new Error('Mysoft: accessToken alınamadı');
    }
    const ttlSec =
      typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
        ? data.expires_in
        : 3600;
    this.sessionCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + ttlSec * 1000 - 60_000,
    });
    return token;
  }

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const root = this.base(credentials);
    const token = await this.getToken(credentials);
    return axios.create({
      baseURL: root,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      await this.getToken(credentials);
      return { success: true };
    } catch (error) {
      this.logger.warn('Mysoft bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const client = await this.getClient(credentials);
      const { data } = await client.get<MysoftProductsResponse>('/products', {
        params: { limit: 500, offset: 0 },
      });
      const raw = data.items ?? data.products ?? [];
      return raw.map((p, i) => {
        const code = (p.code ?? p.id ?? '').trim() || `row-${i}`;
        return {
          erpProductId: code,
          barcode: (p.barcode ?? p.code ?? code).trim(),
          name: (p.name ?? code).trim() || code,
          stockQuantity: Math.max(
            0,
            Math.round(Number(p.stock ?? p.quantity ?? 0)),
          ),
        };
      });
    } catch (error) {
      this.logger.warn('Mysoft ürün listesi alınamadı', {
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
    const number = String(data.number ?? id);
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: number,
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
