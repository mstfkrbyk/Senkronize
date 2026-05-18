import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { AxiosInstance } from 'axios';

import { PARASUT_AUTH_URL, PARASUT_BASE_URL } from './parasut.constants';
import type {
  ParasutContactsResponse,
  ParasutEInvoice,
  ParasutInvoice,
  ParasutProductsResponse,
  ParasutTokenResponse,
} from './parasut.types';

@Injectable()
export class ParasutAdapter implements IErpAdapter {
  readonly erpType = 'PARASUT';
  private readonly logger = new Logger(ParasutAdapter.name);
  private readonly tokenCache = new Map<string, { token: string; expiresAt: number }>();

  private async getToken(
    clientId: string,
    clientSecret: string,
    companyId: string,
  ): Promise<string> {
    const key = `${clientId}:${companyId}`;
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const { data } = await axios.post<ParasutTokenResponse>(
      PARASUT_AUTH_URL,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000 },
    );

    this.tokenCache.set(key, {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
    });
    return data.access_token;
  }

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const clientId = credentials.clientId;
    const clientSecret = credentials.clientSecret;
    const companyId = credentials.companyId;
    if (!clientId || !clientSecret || !companyId) {
      throw new Error('Paraşüt: clientId, clientSecret ve companyId zorunludur');
    }
    const token = await this.getToken(clientId, clientSecret, companyId);
    return axios.create({
      baseURL: `${PARASUT_BASE_URL}/${companyId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = await this.getClient(credentials);
      await client.get('/me');
      return true;
    } catch (error) {
      this.logger.warn('Paraşüt bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = await this.getClient(credentials);
    const out: ErpProduct[] = [];
    let page = 1;
    let totalPages = 1;
    try {
      do {
        const { data } = await client.get<ParasutProductsResponse>('/products', {
          params: { 'page[size]': 250, 'page[number]': page },
        });
        const rows = data.data ?? [];
        for (const p of rows) {
          out.push({
            erpProductId: p.id,
            barcode: p.attributes.code,
            name: p.attributes.name,
            stockQuantity: 0,
            purchasePrice: p.attributes.purchase_price,
          });
        }
        totalPages = data.meta?.total_pages ?? 1;
        page += 1;
      } while (page <= totalPages && page <= 100);
    } catch (error) {
      this.logger.warn('Paraşüt ürün listesi sayfalanamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
    return out;
  }

  /**
   * Müşteri (cari) arama — `GET /contacts?q=...`
   */
  async searchContacts(
    credentials: Record<string, string>,
    nameQuery: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const client = await this.getClient(credentials);
    const { data } = await client.get<ParasutContactsResponse>('/contacts', {
      params: { q: nameQuery, 'page[size]': 50, 'page[number]': 1 },
    });
    return (data.data ?? []).map((c) => ({
      id: c.id,
      name:
        c.attributes.name ??
        c.attributes.title ??
        c.attributes.email ??
        c.id,
    }));
  }

  /**
   * E-fatura gönderimi — `POST /e_invoices` (JSON:API gövdesi)
   */
  async sendEInvoice(
    credentials: Record<string, string>,
    attributes: Record<string, unknown>,
  ): Promise<ParasutEInvoice> {
    const client = await this.getClient(credentials);
    const { data } = await client.post<{ data: ParasutEInvoice }>('/e_invoices', {
      data: {
        type: 'e_invoices',
        attributes,
      },
    });
    return data.data;
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = await this.getClient(credentials);
    const today = new Date().toISOString().split('T')[0];
    const body = {
      data: {
        type: 'sales_invoices',
        attributes: {
          item_type: 'invoice' as const,
          description: `Sipariş: ${invoice.orderRef}`,
          issue_date: today,
          due_date: today,
          currency: invoice.currency,
          net_total: invoice.totalAmount,
          gross_total: invoice.totalAmount,
        },
      },
    };
    const { data } = await client.post<{ data: ParasutInvoice }>('/sales_invoices', body);
    return {
      erpInvoiceId: data.data.id,
      orderRef: invoice.orderRef,
      invoiceNumber: data.data.id,
      totalAmount: data.data.attributes.gross_total,
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
      params['filter[issue_date_gt]'] = since.toISOString().split('T')[0];
    }
    const { data } = await client.get<{ data: ParasutInvoice[] }>('/sales_invoices', {
      params,
    });
    return data.data.map((inv) => ({
      erpInvoiceId: inv.id,
      orderRef: inv.attributes.description,
      invoiceNumber: inv.id,
      totalAmount: inv.attributes.gross_total,
      currency: inv.attributes.currency,
      issuedAt: inv.attributes.issue_date,
      lines: [],
    }));
  }
}
