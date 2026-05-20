import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { axiosWithRetry } from '../../common/utils/http-retry';

const BIZIMHESAP_BASE_URL = 'https://api.bizimhesap.com';

interface BizimHesapMeResponse {
  data: {
    companyName?: string;
  };
}

interface BizimHesapProductRow {
  id: string;
  code?: string;
  name: string;
  unit?: string;
  stockQuantity: number;
  purchasePrice?: number;
  salePrice?: number;
}

interface BizimHesapProductsResponse {
  data: BizimHesapProductRow[];
  meta?: { total?: number; page?: number; limit?: number };
}

interface BizimHesapInvoiceRow {
  id: string;
  invoiceNo?: string;
  invoiceType?: string;
  date?: string;
  customerId?: string;
  totalAmount?: number;
  currency?: string;
  lines?: Array<{
    productId?: string;
    quantity: number;
    unitPrice: number;
    vatRate?: number;
    total?: number;
    description?: string;
  }>;
}

interface BizimHesapInvoicesResponse {
  data: BizimHesapInvoiceRow[];
}

function resolveApiToken(credentials: Record<string, string>): string {
  const token =
    credentials.apiToken?.trim() ||
    credentials.apiKey?.trim() ||
    credentials.token?.trim();
  if (!token) {
    throw new Error('BizimHesap: apiToken (veya apiKey) zorunludur');
  }
  return token;
}

@Injectable()
export class BizimHesapErpAdapter implements IErpAdapter {
  readonly erpType = 'BIZIMHESAP';
  private readonly logger = new Logger(BizimHesapErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiToken = resolveApiToken(credentials);
    return axios.create({
      baseURL: BIZIMHESAP_BASE_URL,
      headers: {
        'x-api-token': apiToken,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  private async request<T>(
    client: AxiosInstance,
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    params?: Record<string, string | number>,
  ): Promise<T> {
    return axiosWithRetry<T>(
      {
        method,
        url: path,
        baseURL: client.defaults.baseURL,
        headers: client.defaults.headers as Record<string, string>,
        data: body,
        params,
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = this.getClient(credentials);
      const me = await this.request<BizimHesapMeResponse>(client, 'GET', '/v2/me');
      const products = await this.request<BizimHesapProductsResponse>(
        client,
        'GET',
        '/v2/products',
        undefined,
        { page: 1, limit: 1 },
      );
      return {
        success: true,
        companyName: me.data.companyName,
        version: 'v2',
        productCount: products.meta?.total ?? products.data.length,
      };
    } catch (error) {
      this.logger.warn('BizimHesap bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = this.getClient(credentials);
    const out: ErpProduct[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 100) {
      const response = await this.request<BizimHesapProductsResponse>(
        client,
        'GET',
        '/v2/products',
        undefined,
        { page, limit: 100 },
      );
      for (const p of response.data) {
        out.push({
          erpProductId: p.id,
          barcode: (p.code ?? p.id).trim(),
          name: p.name.trim(),
          stockQuantity: Math.max(0, Math.round(Number(p.stockQuantity ?? 0))),
          purchasePrice: p.purchasePrice,
        });
      }
      const total = response.meta?.total;
      if (total !== undefined) {
        hasMore = out.length < total;
      } else {
        hasMore = response.data.length === 100;
      }
      page += 1;
    }

    return out;
  }

  async updateStock(
    credentials: Record<string, string>,
    productId: string,
    stockQuantity: number,
  ): Promise<void> {
    const client = this.getClient(credentials);
    await this.request(client, 'PUT', `/v2/products/${productId}/stock`, {
      stockQuantity,
    });
  }

  async getCustomers(
    credentials: Record<string, string>,
    page = 1,
    limit = 100,
  ): Promise<Array<{ id: string; name: string }>> {
    const client = this.getClient(credentials);
    const response = await this.request<{ data: Array<{ id: string; name?: string }> }>(
      client,
      'GET',
      '/v2/customers',
      undefined,
      { page, limit },
    );
    return response.data.map((c) => ({
      id: c.id,
      name: c.name ?? c.id,
    }));
  }

  async getAccounts(
    credentials: Record<string, string>,
    type: 'CUSTOMER' | 'SUPPLIER' = 'CUSTOMER',
  ): Promise<Array<{ id: string; name: string }>> {
    const client = this.getClient(credentials);
    const response = await this.request<{ data: Array<{ id: string; name?: string }> }>(
      client,
      'GET',
      '/v2/accounts',
      undefined,
      { type },
    );
    return response.data.map((a) => ({
      id: a.id,
      name: a.name ?? a.id,
    }));
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = this.getClient(credentials);
    const today = new Date().toISOString().slice(0, 10);
    const customerId =
      credentials.defaultCustomerId?.trim() ||
      (await this.getCustomers(credentials, 1, 1))[0]?.id;
    if (!customerId) {
      throw new Error('BizimHesap: fatura için müşteri bulunamadı');
    }

    const body = {
      invoiceType: 'SALE' as const,
      date: today,
      customerId,
      lines: invoice.lines.map((line, index) => ({
        productId: credentials[`lineProductId_${String(index)}`] ?? undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.taxRate,
        description: line.description,
      })),
    };

    const response = await this.request<{ data: BizimHesapInvoiceRow }>(
      client,
      'POST',
      '/v2/invoices',
      body,
    );
    const inv = response.data;
    return {
      erpInvoiceId: inv.id,
      orderRef: invoice.orderRef,
      invoiceNumber: inv.invoiceNo ?? inv.id,
      totalAmount: inv.totalAmount ?? invoice.totalAmount,
      currency: inv.currency ?? invoice.currency,
      issuedAt: inv.date ?? today,
      lines: invoice.lines,
    };
  }

  async sendEArchive(
    credentials: Record<string, string>,
    invoiceId: string,
  ): Promise<void> {
    const client = this.getClient(credentials);
    await this.request(client, 'POST', `/v2/invoices/${invoiceId}/e-archive`);
  }

  async getInvoices(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpInvoice[]> {
    const client = this.getClient(credentials);
    const params: Record<string, string | number> = { page: 1, limit: 100 };
    if (since) {
      params.startDate = since.toISOString().slice(0, 10);
    }
    const response = await this.request<BizimHesapInvoicesResponse>(
      client,
      'GET',
      '/v2/invoices',
      undefined,
      params,
    );
    return response.data.map((inv) => ({
      erpInvoiceId: inv.id,
      orderRef: inv.customerId ?? inv.id,
      invoiceNumber: inv.invoiceNo ?? inv.id,
      totalAmount: inv.totalAmount ?? 0,
      currency: inv.currency ?? 'TRY',
      issuedAt: inv.date ?? new Date().toISOString().slice(0, 10),
      lines: (inv.lines ?? []).map((line) => ({
        description: line.description ?? '',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.vatRate ?? 0,
        total: line.total ?? line.quantity * line.unitPrice,
      })),
    }));
  }
}
