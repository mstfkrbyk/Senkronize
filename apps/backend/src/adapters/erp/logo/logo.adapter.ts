import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';
import type { AxiosInstance } from 'axios';

import {
  ErpRestHttpService,
  pickCode,
  pickLogicalRef,
  pickName,
  rowsFromPayload,
} from '../erp-rest-http';
import { isRecord } from '../erp-adapter.utils';
import type { ErpStockCapableAdapter } from '../../../jobs/erp-sync.helpers';

import { LOGO_PLATFORM_KEY, LOGO_REST_API_PATH } from './logo.constants';
import type { LogoCurrentRow, LogoItemRow, LogoSalesInvoiceRow } from './logo.types';

type ErpInvoiceInput = Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'> & {
  customerName?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
    sku?: string;
  }>;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeCustomerCode(orderRef: string): string {
  const cleaned = orderRef.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
  return cleaned.length > 0 ? `SNK-${cleaned}` : `SNK-${Date.now()}`;
}

function pickInvoiceMeta(data: unknown): { id: string; number: string } {
  if (!isRecord(data)) {
    return { id: 'unknown', number: 'unknown' };
  }
  const row = data as LogoSalesInvoiceRow & Record<string, unknown>;
  const ref = pickLogicalRef(row);
  const num =
    (typeof row.FICHENO === 'string' && row.FICHENO) ||
    (typeof row.NUMBER === 'string' && row.NUMBER) ||
    (typeof row.invoiceNumber === 'string' && row.invoiceNumber) ||
    (ref !== null ? String(ref) : '');
  const id = ref !== null ? String(ref) : num || 'unknown';
  return { id, number: num || id };
}

@Injectable()
export class LogoTigerErpAdapter implements IErpAdapter, ErpStockCapableAdapter {
  readonly erpType = LOGO_PLATFORM_KEY;
  private readonly logger = new Logger(LogoTigerErpAdapter.name);

  constructor(private readonly http: ErpRestHttpService) {}

  private client(credentials: Record<string, string>): AxiosInstance {
    const baseURL = this.http.buildBaseUrl(credentials, LOGO_REST_API_PATH);
    return this.http.createClient(baseURL, this.http.resolveBasicOrBearerAuth(credentials));
  }

  private async apiGet<T>(
    credentials: Record<string, string>,
    organizationId: string,
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const client = this.client(credentials);
    return this.http.request<T>(LOGO_PLATFORM_KEY, organizationId, {
      method: 'GET',
      url: path,
      baseURL: client.defaults.baseURL,
      headers: client.defaults.headers as Record<string, string>,
      params,
      timeout: client.defaults.timeout as number,
    });
  }

  private async apiWrite<T>(
    credentials: Record<string, string>,
    organizationId: string,
    method: 'POST' | 'PATCH',
    path: string,
    data?: unknown,
  ): Promise<T> {
    const client = this.client(credentials);
    return this.http.request<T>(LOGO_PLATFORM_KEY, organizationId, {
      method,
      url: path,
      baseURL: client.defaults.baseURL,
      headers: client.defaults.headers as Record<string, string>,
      data,
      timeout: client.defaults.timeout as number,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const data = await this.apiGet<unknown>(credentials, 'connection-test', '/items', {
        RECORDTYPE: 'Y',
        limit: 1,
      });
      const rows = rowsFromPayload(data);
      return {
        success: true,
        companyName: credentials.companyName,
        version: '1.0.0',
        productCount: rows.length,
      };
    } catch (error) {
      this.logger.warn('Logo Tiger bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const orgId = credentials.organizationId ?? 'global';
    const out: ErpProduct[] = [];
    let offset = 0;
    const pageSize = 100;

    for (let page = 0; page < 100; page += 1) {
      const data = await this.apiGet<unknown>(credentials, orgId, '/items', {
        RECORDTYPE: 'Y',
        limit: pageSize,
        offset,
      });
      const rows = rowsFromPayload(data) as LogoItemRow[];
      if (rows.length === 0) {
        break;
      }
      for (const row of rows) {
        const rec = row as Record<string, unknown>;
        const code = pickCode(rec);
        if (!code) {
          continue;
        }
        const ref = pickLogicalRef(rec);
        out.push({
          erpProductId: ref !== null ? String(ref) : code,
          barcode: (typeof row.BARCODE === 'string' ? row.BARCODE : code).trim(),
          name: pickName(rec, code),
          stockQuantity: Math.max(0, Math.round(Number(row.ONHAND ?? 0))),
          purchasePrice:
            row.SALESPRICE !== undefined ? Number(row.SALESPRICE) : undefined,
        });
      }
      if (rows.length < pageSize) {
        break;
      }
      offset += pageSize;
    }

    return out;
  }

  async updateStock(
    credentials: Record<string, string>,
    productId: string,
    quantity: number,
    _note?: string,
  ): Promise<void> {
    const orgId = credentials.organizationId ?? 'global';
    await this.apiWrite(credentials, orgId, 'PATCH', `/items/${productId}`, {
      ONHAND: quantity,
    });
  }

  private async findItemByCode(
    credentials: Record<string, string>,
    orgId: string,
    code: string,
  ): Promise<number | null> {
    const data = await this.apiGet<unknown>(credentials, orgId, '/items', {
      CODE: code,
      RECORDTYPE: 'Y',
    });
    const rows = rowsFromPayload(data);
    if (rows.length === 0) {
      return null;
    }
    return pickLogicalRef(rows[0]);
  }

  private async ensureItem(
    credentials: Record<string, string>,
    orgId: string,
    sku: string,
    name: string,
    unitPrice: number,
  ): Promise<number> {
    const existing = await this.findItemByCode(credentials, orgId, sku);
    if (existing !== null) {
      return existing;
    }
    const created = await this.apiWrite<unknown>(credentials, orgId, 'POST', '/items', {
      CODE: sku,
      NAME: name.slice(0, 200),
      RECORDTYPE: 'Y',
      SALESPRICE: unitPrice,
    });
    if (isRecord(created)) {
      const ref = pickLogicalRef(created);
      if (ref !== null) {
        return ref;
      }
    }
    const refetched = await this.findItemByCode(credentials, orgId, sku);
    if (refetched === null) {
      throw new Error(`Logo: stok kartı oluşturulamadı (${sku})`);
    }
    return refetched;
  }

  private async findCurrentByCode(
    credentials: Record<string, string>,
    orgId: string,
    code: string,
  ): Promise<number | null> {
    const data = await this.apiGet<unknown>(credentials, orgId, '/currents', { CODE: code });
    const rows = rowsFromPayload(data) as LogoCurrentRow[];
    if (rows.length === 0) {
      return null;
    }
    return pickLogicalRef(rows[0] as Record<string, unknown>);
  }

  private async ensureCurrent(
    credentials: Record<string, string>,
    orgId: string,
    code: string,
    title: string,
  ): Promise<number> {
    const existing = await this.findCurrentByCode(credentials, orgId, code);
    if (existing !== null) {
      return existing;
    }
    const created = await this.apiWrite<unknown>(credentials, orgId, 'POST', '/currents', {
      CODE: code,
      TITLE: title.slice(0, 200),
    });
    if (isRecord(created)) {
      const ref = pickLogicalRef(created);
      if (ref !== null) {
        return ref;
      }
    }
    const refetched = await this.findCurrentByCode(credentials, orgId, code);
    if (refetched === null) {
      throw new Error(`Logo: cari oluşturulamadı (${code})`);
    }
    return refetched;
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: ErpInvoiceInput,
  ): Promise<ErpInvoice> {
    const orgId = credentials.organizationId ?? 'global';
    const today = todayIsoDate();
    const customerCode = sanitizeCustomerCode(invoice.orderRef);
    const customerTitle = invoice.customerName?.trim() || customerCode;
    const currAccRef = await this.ensureCurrent(
      credentials,
      orgId,
      customerCode,
      customerTitle,
    );

    const transactionLines: Array<{
      STOCKREF: number;
      QUANTITY: number;
      PRICE: number;
    }> = [];

    for (const line of invoice.lines) {
      const sku = (line.sku ?? line.description).trim();
      const itemRef = await this.ensureItem(
        credentials,
        orgId,
        sku,
        line.description,
        line.unitPrice,
      );
      transactionLines.push({
        STOCKREF: itemRef,
        QUANTITY: line.quantity,
        PRICE: line.unitPrice,
      });
    }

    await this.apiWrite(credentials, orgId, 'POST', '/salesorders', {
      DATE_: today,
      CURRACCREF: currAccRef,
      TRANSACTIONS: { items: transactionLines },
    });

    const invData = await this.apiWrite<unknown>(credentials, orgId, 'POST', '/salesinvoices', {
      DATE_: today,
      CURRACCREF: currAccRef,
      ARP_CODE: customerCode,
      TRANSACTIONS: { items: transactionLines },
      TOTAL: invoice.totalAmount,
      CURRENCY: invoice.currency,
    });

    const meta = pickInvoiceMeta(invData);
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
    const orgId = credentials.organizationId ?? 'global';
    const dateFilter = since
      ? since.toISOString().slice(0, 10)
      : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    try {
      const data = await this.apiGet<unknown>(credentials, orgId, '/stockfiche', {
        DOCDATE: dateFilter,
      });
      const rows = rowsFromPayload(data);
      return rows.map((row, i) => {
        const ref = pickLogicalRef(row);
        const id = ref !== null ? String(ref) : `row-${i}`;
        return {
          erpInvoiceId: id,
          orderRef: pickCode(row) || id,
          invoiceNumber: pickCode(row) || id,
          totalAmount: Number(row.TOTAL ?? row.total ?? 0),
          currency: 'TRY',
          issuedAt: dateFilter,
          lines: [],
        };
      });
    } catch (error) {
      this.logger.warn('Logo stok fişi listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }
}
