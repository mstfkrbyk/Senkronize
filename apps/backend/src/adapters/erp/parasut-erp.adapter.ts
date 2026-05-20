import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { parseJsonApi, type JsonApiResource } from './erp-adapter.utils';

const PARASUT_AUTH_URL = 'https://api.parasut.com/oauth/token';
const PARASUT_BASE_URL = 'https://api.parasut.com/v4';

interface ParasutTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface ParasutProductAttributes {
  name: string;
  code?: string;
  inventory_tracking?: boolean;
  initial_stock_count?: number;
  purchase_price?: number;
}

interface ParasutMeResponse {
  data: {
    id: string;
    attributes: {
      name?: string;
    };
  };
}

interface ParasutInvoiceAttributes {
  item_type: string;
  description?: string;
  issue_date: string;
  due_date?: string;
  currency: string;
  net_total?: number;
  gross_total?: number;
}

@Injectable()
export class ParasutErpAdapter implements IErpAdapter {
  readonly erpType = 'PARASUT';
  private readonly logger = new Logger(ParasutErpAdapter.name);
  private readonly tokenCache = new Map<string, { token: string; expiresAt: number }>();

  private cacheKey(credentials: Record<string, string>): string {
    return `${credentials.clientId ?? ''}:${credentials.companyId ?? ''}:${credentials.username ?? ''}`;
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('Paraşüt: clientId ve clientSecret zorunludur');
    }

    const key = this.cacheKey(credentials);
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 5000) {
      return cached.token;
    }

    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: username && password ? 'password' : 'client_credentials',
    });
    if (username && password) {
      body.set('username', username);
      body.set('password', password);
    }

    const data = await axiosWithRetry<ParasutTokenResponse>(
      {
        method: 'POST',
        url: PARASUT_AUTH_URL,
        data: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20_000,
      },
      { maxRetries: 2 },
    );

    const ttlMs = Math.max(data.expires_in * 1000 - 60_000, 60_000);
    this.tokenCache.set(key, {
      token: data.access_token,
      expiresAt: Date.now() + ttlMs,
    });
    return data.access_token;
  }

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const companyId = credentials.companyId?.trim();
    if (!companyId) {
      throw new Error('Paraşüt: companyId zorunludur');
    }
    const token = await this.getAccessToken(credentials);
    return axios.create({
      baseURL: `${PARASUT_BASE_URL}/${companyId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = await this.getClient(credentials);
      const { data: meData } = await client.get<ParasutMeResponse>('/me');
      const { data: productsData } = await client.get<{ data: unknown[]; meta?: { total_count?: number } }>(
        '/products',
        { params: { 'filter[type]': 'product', 'page[size]': 1 } },
      );
      return {
        success: true,
        companyName: meData.data.attributes.name,
        version: 'v4',
        productCount: productsData.meta?.total_count ?? productsData.data.length,
      };
    } catch (error) {
      this.logger.warn('Paraşüt bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = await this.getClient(credentials);
    const out: ErpProduct[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const { data } = await client.get<{ data: Array<{ id: string; attributes: ParasutProductAttributes }>; meta?: { total_pages?: number } }>(
        '/products',
        {
          params: {
            'filter[type]': 'product',
            'page[size]': 100,
            'page[number]': page,
          },
        },
      );
      const rows = parseJsonApi<ParasutProductAttributes>({
        data: data.data as unknown as JsonApiResource[],
      });
      for (const p of rows) {
        out.push({
          erpProductId: p.id,
          barcode: (p.code ?? p.id).trim(),
          name: p.name.trim(),
          stockQuantity: Math.max(
            0,
            Math.round(Number(p.initial_stock_count ?? 0)),
          ),
          purchasePrice: p.purchase_price,
        });
      }
      totalPages = data.meta?.total_pages ?? 1;
      page += 1;
    } while (page <= totalPages && page <= 100);

    return out;
  }

  async updateStock(
    credentials: Record<string, string>,
    productId: string,
    quantity: number,
    note = 'Senkronize sync',
  ): Promise<void> {
    const client = await this.getClient(credentials);
    const today = new Date().toISOString().slice(0, 10);
    await client.post('/stock_movements', {
      data: {
        type: 'stock_movements',
        attributes: { date: today, quantity, note },
        relationships: {
          stockable: { data: { id: productId, type: 'products' } },
        },
      },
    });
  }

  async getContacts(
    credentials: Record<string, string>,
    contactType: 'customer' | 'supplier' = 'customer',
  ): Promise<Array<{ id: string; name: string }>> {
    const client = await this.getClient(credentials);
    const { data } = await client.get<{
      data: Array<{ id: string; attributes: { name?: string; email?: string } }>;
    }>('/contacts', {
      params: {
        'filter[contact_type]': contactType,
        'page[size]': 100,
      },
    });
    return parseJsonApi<{ name?: string; email?: string }>({ data: data.data }).map(
      (c) => ({
        id: c.id,
        name: c.name ?? c.email ?? c.id,
      }),
    );
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = await this.getClient(credentials);
    const today = new Date().toISOString().slice(0, 10);
    const contactId =
      credentials.defaultContactId?.trim() ||
      (await this.getContacts(credentials))[0]?.id;

    const body: Record<string, unknown> = {
      data: {
        type: 'sales_invoices',
        attributes: {
          item_type: 'invoice',
          description: `Sipariş: ${invoice.orderRef}`,
          issue_date: today,
          due_date: today,
          currency: invoice.currency,
          net_total: invoice.totalAmount,
          gross_total: invoice.totalAmount,
        },
        ...(contactId
          ? {
              relationships: {
                contact: { data: { id: contactId, type: 'contacts' } },
              },
            }
          : {}),
      },
    };

    const { data } = await client.post<{
      data: { id: string; attributes: ParasutInvoiceAttributes };
    }>('/sales_invoices', body);

    return {
      erpInvoiceId: data.data.id,
      orderRef: invoice.orderRef,
      invoiceNumber: data.data.id,
      totalAmount: data.data.attributes.gross_total ?? invoice.totalAmount,
      currency: data.data.attributes.currency,
      issuedAt: data.data.attributes.issue_date,
      lines: invoice.lines,
    };
  }

  async getInvoices(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpInvoice[]> {
    const client = await this.getClient(credentials);
    const params: Record<string, string | number> = { 'page[size]': 100 };
    if (since) {
      params['filter[issue_date_gt]'] = since.toISOString().slice(0, 10);
    }
    const { data } = await client.get<{
      data: Array<{ id: string; attributes: ParasutInvoiceAttributes }>;
    }>('/sales_invoices', { params });

    return parseJsonApi<ParasutInvoiceAttributes>({
      data: data.data as unknown as JsonApiResource[],
    }).map((inv) => ({
      erpInvoiceId: inv.id,
      orderRef: inv.description ?? inv.id,
      invoiceNumber: inv.id,
      totalAmount: inv.gross_total ?? 0,
      currency: inv.currency,
      issuedAt: inv.issue_date,
      lines: [],
    }));
  }
}
