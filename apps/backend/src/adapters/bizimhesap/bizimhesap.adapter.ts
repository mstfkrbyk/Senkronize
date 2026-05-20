import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { AxiosInstance } from 'axios';

import { BIZIMHESAP_BASE_URL } from './bizimhesap.constants';
import type {
  BizimHesapAuthResponse,
  BizimHesapInvoice,
  BizimHesapInvoicesResponse,
  BizimHesapProductsResponse,
} from './bizimhesap.types';

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class BizimHesapAdapter implements IErpAdapter {
  readonly erpType = 'BIZIMHESAP';
  private readonly logger = new Logger(BizimHesapAdapter.name);
  private readonly tokenCache = new Map<string, CachedToken>();

  private cacheKey(apiToken: string, companyId: string): string {
    return `${apiToken}\0${companyId}`;
  }

  private async getToken(apiToken: string, companyId: string): Promise<string> {
    const key = this.cacheKey(apiToken, companyId);
    const cached = this.tokenCache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now + 5000) {
      return cached.token;
    }
    const { data } = await axios.post<BizimHesapAuthResponse>(
      `${BIZIMHESAP_BASE_URL}/auth/token`,
      { api_token: apiToken, company_id: companyId },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15_000,
      },
    );
    const ttlMs = Math.max((data.expires_in ?? 3600) * 1000, 60_000);
    const expiresAt = now + ttlMs;
    this.tokenCache.set(key, { token: data.access_token, expiresAt });
    return data.access_token;
  }

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const apiToken = credentials.apiToken;
    const companyId = credentials.companyId;
    if (!apiToken || !companyId) {
      throw new Error('BizimHesap: apiToken ve companyId zorunludur');
    }
    const token = await this.getToken(apiToken, companyId);
    return axios.create({
      baseURL: BIZIMHESAP_BASE_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = await this.getClient(credentials);
      await client.get('/company');
      return { success: true };
    } catch (error) {
      this.logger.warn('BizimHesap bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = await this.getClient(credentials);
    const { data } = await client.get<BizimHesapProductsResponse>('/products', {
      params: { per_page: 500 },
    });
    return data.data.map((p) => ({
      erpProductId: p.id,
      barcode: p.barcode,
      name: p.name,
      stockQuantity: p.stock_quantity,
      purchasePrice: p.purchase_price,
    }));
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = await this.getClient(credentials);
    const { data } = await client.post<{ data: BizimHesapInvoice }>(
      '/invoices',
      {
        reference: invoice.orderRef,
        total_amount: invoice.totalAmount,
        currency: invoice.currency,
        lines: invoice.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          tax_rate: l.taxRate,
          total: l.total,
        })),
      },
    );
    const inv = data.data;
    return {
      erpInvoiceId: inv.id,
      orderRef: inv.reference,
      invoiceNumber: inv.invoice_no,
      totalAmount: inv.total_amount,
      currency: inv.currency,
      issuedAt: inv.issue_date,
      lines: inv.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unit_price,
        taxRate: l.tax_rate,
        total: l.total,
      })),
    };
  }

  async getInvoices(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpInvoice[]> {
    const client = await this.getClient(credentials);
    const params: Record<string, string> = {};
    if (since) {
      params.start_date = since.toISOString().slice(0, 10);
    }
    const { data } = await client.get<BizimHesapInvoicesResponse>('/invoices', {
      params,
    });
    return data.data.map((inv) => ({
      erpInvoiceId: inv.id,
      orderRef: inv.reference,
      invoiceNumber: inv.invoice_no,
      totalAmount: inv.total_amount,
      currency: inv.currency,
      issuedAt: inv.issue_date,
      lines: inv.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unit_price,
        taxRate: l.tax_rate,
        total: l.total,
      })),
    }));
  }
}
