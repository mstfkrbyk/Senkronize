import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';

import type { ErpStockCapableAdapter } from '../../../jobs/erp-sync.helpers';
import { isRecord } from '../erp-adapter.utils';
import { ErpRestHttpService } from '../erp-rest-http';

import {
  KOLAYBI_BASE_URL,
  KOLAYBI_PAGE_SIZE,
  KOLAYBI_PLATFORM_KEY,
} from './kolaybi.constants';
import type {
  KolaybiInvoiceCreateResponse,
  KolaybiInvoiceRow,
  KolaybiPaginatedMeta,
  KolaybiPaginatedResponse,
  KolaybiProductRow,
} from './kolaybi.types';

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
    (typeof data.invoiceId === 'string' && data.invoiceId) ||
    num ||
    'unknown';
  return { id, number: num || id };
}

function normalizeProductsPayload(data: unknown): KolaybiProductRow[] {
  if (Array.isArray(data)) {
    return data as KolaybiProductRow[];
  }
  if (isRecord(data)) {
    const env = data as KolaybiPaginatedResponse<KolaybiProductRow>;
    if (Array.isArray(env.data)) {
      return env.data;
    }
    if (Array.isArray(env.items)) {
      return env.items;
    }
    if (Array.isArray(data.results)) {
      return data.results as KolaybiProductRow[];
    }
  }
  return [];
}

function resolveLastPage(
  meta: KolaybiPaginatedMeta | undefined,
  rowCount: number,
  currentPage: number,
): number {
  if (meta && typeof meta.last_page === 'number' && meta.last_page > 0) {
    return meta.last_page;
  }
  return rowCount < KOLAYBI_PAGE_SIZE ? currentPage : currentPage + 1;
}

function mapProductRow(p: KolaybiProductRow, index: number): ErpProduct {
  const code = (p.id ?? p.code ?? p.sku ?? `row-${index}`).toString().trim() || `row-${index}`;
  const name = (p.name ?? p.title ?? code).toString().trim() || code;
  const stock = p.stockQuantity ?? p.quantity ?? p.stock ?? 0;
  const purchasePrice =
    p.purchasePrice !== undefined && Number.isFinite(Number(p.purchasePrice))
      ? Number(p.purchasePrice)
      : undefined;
  return {
    erpProductId: code,
    barcode: (p.sku ?? p.code ?? code).toString().trim(),
    name,
    stockQuantity: Math.max(0, Math.round(Number(stock))),
    ...(purchasePrice !== undefined ? { purchasePrice } : {}),
  };
}

@Injectable()
export class KolaybiErpAdapter implements IErpAdapter, ErpStockCapableAdapter {
  readonly erpType = KOLAYBI_PLATFORM_KEY;
  private readonly logger = new Logger(KolaybiErpAdapter.name);

  constructor(private readonly http: ErpRestHttpService) {}

  private orgId(credentials: Record<string, string>): string {
    return credentials.organizationId ?? 'global';
  }

  private authHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private requireApiKey(credentials: Record<string, string>): string {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      throw new Error('Kolaybi: apiKey zorunludur');
    }
    return apiKey;
  }

  private async apiGet<T>(
    credentials: Record<string, string>,
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const apiKey = this.requireApiKey(credentials);
    return this.http.request<T>(KOLAYBI_PLATFORM_KEY, this.orgId(credentials), {
      method: 'GET',
      url: path.startsWith('/') ? path : `/${path}`,
      baseURL: KOLAYBI_BASE_URL,
      headers: this.authHeaders(apiKey),
      params,
      timeout: 30_000,
    });
  }

  private async apiWrite<T>(
    credentials: Record<string, string>,
    method: 'POST' | 'PUT',
    path: string,
    data?: unknown,
  ): Promise<T> {
    const apiKey = this.requireApiKey(credentials);
    return this.http.request<T>(KOLAYBI_PLATFORM_KEY, this.orgId(credentials), {
      method,
      url: path.startsWith('/') ? path : `/${path}`,
      baseURL: KOLAYBI_BASE_URL,
      headers: this.authHeaders(apiKey),
      data,
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      return { success: false };
    }
    try {
      await this.apiGet<unknown>(credentials, '/products', { page: 1, limit: 1 });
      return { success: true, companyName: credentials.companyName };
    } catch (error) {
      this.logger.warn('Kolaybi bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const out: ErpProduct[] = [];
    let page = 1;
    let lastPage = 1;

    for (let i = 0; i < 200 && page <= lastPage; i += 1) {
      const data = await this.apiGet<KolaybiPaginatedResponse<KolaybiProductRow>>(
        credentials,
        '/products',
        { page, limit: KOLAYBI_PAGE_SIZE },
      );
      const rows = normalizeProductsPayload(data);
      if (rows.length === 0) {
        break;
      }
      for (let j = 0; j < rows.length; j += 1) {
        out.push(mapProductRow(rows[j], out.length + j));
      }
      const meta: KolaybiPaginatedMeta | undefined = isRecord(data) && isRecord(data.meta)
        ? (data.meta as KolaybiPaginatedMeta)
        : undefined;
      lastPage = resolveLastPage(meta, rows.length, page);
      page += 1;
    }

    return out;
  }

  async updateStock(
    credentials: Record<string, string>,
    productId: string,
    quantity: number,
  ): Promise<void> {
    await this.apiWrite(credentials, 'PUT', `/products/${encodeURIComponent(productId)}/stock`, {
      quantity,
    });
  }

  async updatePrice(
    credentials: Record<string, string>,
    productId: string,
    price: number,
  ): Promise<void> {
    await this.apiWrite(credentials, 'PUT', `/products/${encodeURIComponent(productId)}/price`, {
      price,
    });
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const today = new Date().toISOString().split('T')[0];
    const data = await this.apiWrite<KolaybiInvoiceCreateResponse>(
      credentials,
      'POST',
      '/invoices',
      {
        externalReference: invoice.orderRef,
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
      },
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
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpInvoice[]> {
    const out: ErpInvoice[] = [];
    let page = 1;
    let lastPage = 1;
    const createdAfter = since ? since.toISOString() : undefined;

    for (let i = 0; i < 100 && page <= lastPage; i += 1) {
      const params: Record<string, string | number> = { page, limit: KOLAYBI_PAGE_SIZE };
      if (createdAfter) {
        params.created_after = createdAfter;
      }
      const data = await this.apiGet<KolaybiPaginatedResponse<KolaybiInvoiceRow>>(
        credentials,
        '/invoices',
        params,
      );
      const rows = isRecord(data) && Array.isArray(data.data)
        ? (data.data as KolaybiInvoiceRow[])
        : [];
      if (rows.length === 0) {
        break;
      }
      for (const row of rows) {
        const meta = pickInvoiceMeta(row);
        out.push({
          erpInvoiceId: meta.id,
          orderRef: String(row.externalReference ?? row.orderRef ?? meta.number),
          invoiceNumber: meta.number,
          totalAmount: Number(row.totalAmount ?? 0),
          currency: String(row.currency ?? 'TRY'),
          issuedAt: String(row.issueDate ?? row.createdAt ?? todayIso()),
          lines: [],
        });
      }
      const meta: KolaybiPaginatedMeta | undefined = isRecord(data) && isRecord(data.meta)
        ? (data.meta as KolaybiPaginatedMeta)
        : undefined;
      lastPage = resolveLastPage(meta, rows.length, page);
      page += 1;
    }

    return out;
  }
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}
