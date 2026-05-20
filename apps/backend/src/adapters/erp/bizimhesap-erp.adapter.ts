import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { runErpConnectionTest } from './erp-adapter.utils';

const BIZIMHESAP_BASE_URL = 'https://api.bizimhesap.com/v1';

interface BizimHesapProductRow {
  id: string;
  code?: string;
  barcode?: string;
  name: string;
  unit?: string;
  stock_quantity?: number;
  purchase_price?: number;
  sale_price?: number;
}

interface BizimHesapProductsResponse {
  data: BizimHesapProductRow[];
  meta?: { total?: number; page?: number; per_page?: number };
}

interface BizimHesapStockItemRow {
  id: string;
  quantity?: number;
  warehouse_name?: string;
}

interface BizimHesapStockItemsResponse {
  data: BizimHesapStockItemRow[];
}

interface BizimHesapContactRow {
  id: string;
  name?: string;
  email?: string;
  type?: string;
}

interface BizimHesapContactsResponse {
  data: BizimHesapContactRow[];
  meta?: { total?: number; page?: number; per_page?: number };
}

interface BizimHesapInvoiceRow {
  id: string;
  invoice_no?: string;
  issue_date?: string;
  contact_id?: string;
  total_amount?: number;
  currency?: string;
  lines?: Array<{
    product_id?: string;
    quantity: number;
    unit_price: number;
    vat_rate?: number;
    total?: number;
    description?: string;
  }>;
}

interface BizimHesapInvoicesResponse {
  data: BizimHesapInvoiceRow[];
  meta?: { total?: number; page?: number; per_page?: number };
}

interface BizimHesapCategoryRow {
  id: string;
  name: string;
}

interface BizimHesapCategoriesResponse {
  data: BizimHesapCategoryRow[];
}

function resolveApiKey(credentials: Record<string, string>): string {
  const apiKey =
    credentials.apiKey?.trim() ||
    credentials.apiToken?.trim() ||
    credentials.token?.trim();
  if (!apiKey) {
    throw new Error('BizimHesap: apiKey (veya apiToken) zorunludur');
  }
  return apiKey;
}

@Injectable()
export class BizimHesapErpAdapter implements IErpAdapter {
  readonly erpType = 'BIZIMHESAP';
  private readonly logger = new Logger(BizimHesapErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = resolveApiKey(credentials);
    return axios.create({
      baseURL: BIZIMHESAP_BASE_URL,
      headers: {
        Authorization: `Token ${apiKey}`,
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
    const result = await runErpConnectionTest(async () => {
      const client = this.getClient(credentials);
      const products = await this.request<BizimHesapProductsResponse>(
        client,
        'GET',
        '/products',
        undefined,
        { page: 1, per_page: 1 },
      );
      return {
        companyName: credentials.companyName,
        version: 'v1',
        productCount: products.meta?.total ?? products.data.length,
      };
    });
    if (!result.success) {
      this.logger.warn('BizimHesap bağlantı testi başarısız', {
        error: result.message,
      });
    }
    return result;
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
        '/products',
        undefined,
        { page, per_page: 100 },
      );
      for (const p of response.data) {
        let stockQuantity = Math.max(0, Math.round(Number(p.stock_quantity ?? 0)));
        if (stockQuantity === 0) {
          try {
            stockQuantity = await this.getProductStockQuantity(client, p.id);
          } catch {
            // stok_items okunamazsa ürün kaydındaki değer kullanılır
          }
        }
        out.push({
          erpProductId: p.id,
          barcode: (p.barcode ?? p.code ?? p.id).trim(),
          name: p.name.trim(),
          stockQuantity,
          purchasePrice: p.purchase_price,
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

  async getProductStockQuantity(
    client: AxiosInstance,
    productId: string,
  ): Promise<number> {
    const response = await this.request<BizimHesapStockItemsResponse>(
      client,
      'GET',
      `/products/${productId}/stock_items`,
    );
    return response.data.reduce(
      (sum, row) => sum + Math.max(0, Math.round(Number(row.quantity ?? 0))),
      0,
    );
  }

  async updateStock(
    credentials: Record<string, string>,
    productId: string,
    stockQuantity: number,
    note = 'Senkronize',
  ): Promise<void> {
    const client = this.getClient(credentials);
    const currentQty = await this.getProductStockQuantity(client, productId);
    const delta = stockQuantity - currentQty;
    if (delta === 0) {
      return;
    }
    await this.request(client, 'POST', `/products/${productId}/stock_items`, {
      quantity: delta,
      description: note,
      type: delta > 0 ? 'in' : 'out',
    });
  }

  async getProductCategories(
    credentials: Record<string, string>,
  ): Promise<Array<{ id: string; name: string }>> {
    const client = this.getClient(credentials);
    const response = await this.request<BizimHesapCategoriesResponse>(
      client,
      'GET',
      '/product_categories',
    );
    return response.data.map((c) => ({ id: c.id, name: c.name }));
  }

  async getCustomers(
    credentials: Record<string, string>,
    page = 1,
    perPage = 100,
  ): Promise<Array<{ id: string; name: string }>> {
    const client = this.getClient(credentials);
    const response = await this.request<BizimHesapContactsResponse>(
      client,
      'GET',
      '/contacts',
      undefined,
      { type: 'customer', page, per_page: perPage },
    );
    return response.data.map((c) => ({
      id: c.id,
      name: c.name ?? c.email ?? c.id,
    }));
  }

  async createContact(
    credentials: Record<string, string>,
    contact: { name: string; email?: string; phone?: string },
  ): Promise<{ id: string; name: string }> {
    const client = this.getClient(credentials);
    const response = await this.request<{ data: BizimHesapContactRow }>(
      client,
      'POST',
      '/contacts',
      {
        type: 'customer',
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
      },
    );
    const row = response.data;
    return { id: row.id, name: row.name ?? contact.name };
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = this.getClient(credentials);
    const today = new Date().toISOString().slice(0, 10);
    const contactId = await this.resolveContactId(credentials, invoice.orderRef);

    const body = {
      issue_date: today,
      contact_id: contactId,
      currency: invoice.currency,
      description: `Sipariş: ${invoice.orderRef}`,
      lines: invoice.lines.map((line) => ({
        quantity: line.quantity,
        unit_price: line.unitPrice,
        vat_rate: line.taxRate,
        description: line.description,
        total: line.total,
      })),
    };

    const response = await this.request<{ data: BizimHesapInvoiceRow }>(
      client,
      'POST',
      '/sales_invoices',
      body,
    );
    const inv = response.data;
    return {
      erpInvoiceId: inv.id,
      orderRef: invoice.orderRef,
      invoiceNumber: inv.invoice_no ?? inv.id,
      totalAmount: inv.total_amount ?? invoice.totalAmount,
      currency: inv.currency ?? invoice.currency,
      issuedAt: inv.issue_date ?? today,
      lines: invoice.lines,
    };
  }

  async getSalesInvoice(
    credentials: Record<string, string>,
    invoiceId: string,
  ): Promise<ErpInvoice> {
    const client = this.getClient(credentials);
    const response = await this.request<{ data: BizimHesapInvoiceRow }>(
      client,
      'GET',
      `/sales_invoices/${invoiceId}`,
    );
    const inv = response.data;
    return {
      erpInvoiceId: inv.id,
      orderRef: inv.contact_id ?? inv.id,
      invoiceNumber: inv.invoice_no ?? inv.id,
      totalAmount: inv.total_amount ?? 0,
      currency: inv.currency ?? 'TRY',
      issuedAt: inv.issue_date ?? new Date().toISOString().slice(0, 10),
      lines: (inv.lines ?? []).map((line) => ({
        description: line.description ?? '',
        quantity: line.quantity,
        unitPrice: line.unit_price,
        taxRate: line.vat_rate ?? 0,
        total: line.total ?? line.quantity * line.unit_price,
      })),
    };
  }

  async getInvoices(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpInvoice[]> {
    const client = this.getClient(credentials);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = since
      ? since.toISOString().slice(0, 10)
      : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const out: ErpInvoice[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 100) {
      const response = await this.request<BizimHesapInvoicesResponse>(
        client,
        'GET',
        '/sales_invoices',
        undefined,
        { start_date: startDate, end_date: endDate, page },
      );
      for (const inv of response.data) {
        out.push({
          erpInvoiceId: inv.id,
          orderRef: inv.contact_id ?? inv.id,
          invoiceNumber: inv.invoice_no ?? inv.id,
          totalAmount: inv.total_amount ?? 0,
          currency: inv.currency ?? 'TRY',
          issuedAt: inv.issue_date ?? endDate,
          lines: (inv.lines ?? []).map((line) => ({
            description: line.description ?? '',
            quantity: line.quantity,
            unitPrice: line.unit_price,
            taxRate: line.vat_rate ?? 0,
            total: line.total ?? line.quantity * line.unit_price,
          })),
        });
      }
      const total = response.meta?.total;
      if (total !== undefined) {
        hasMore = out.length < total;
      } else {
        hasMore = response.data.length > 0;
      }
      page += 1;
    }

    return out;
  }

  private async resolveContactId(
    credentials: Record<string, string>,
    orderRef: string,
  ): Promise<string> {
    const defaultId = credentials.defaultCustomerId?.trim();
    if (defaultId) {
      return defaultId;
    }
    const customers = await this.getCustomers(credentials, 1, 1);
    if (customers[0]?.id) {
      return customers[0].id;
    }
    const created = await this.createContact(credentials, {
      name: `Senkronize Müşteri (${orderRef})`,
    });
    return created.id;
  }
}
