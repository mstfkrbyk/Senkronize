import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';
import type { AxiosInstance } from 'axios';

import type { ErpStockCapableAdapter } from '../../../jobs/erp-sync.helpers';
import { isRecord } from '../erp-adapter.utils';
import {
  ErpRestHttpService,
  pickCode,
  pickLogicalRef,
  pickName,
  rowsFromPayload,
} from '../erp-rest-http';
import {
  LOGO_ITEMS_PAGE_SIZE,
  LOGO_PLATFORM_KEY,
  LOGO_REST_API_PATH,
} from './logo.constants';

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
  const ref = pickLogicalRef(data);
  const num =
    (typeof data.FICHENO === 'string' && data.FICHENO) ||
    (typeof data.NUMBER === 'string' && data.NUMBER) ||
    (typeof data.invoiceNumber === 'string' && data.invoiceNumber) ||
    (typeof data.Number === 'string' && data.Number) ||
    (ref !== null ? String(ref) : '');
  const id = ref !== null ? String(ref) : num || 'unknown';
  return { id, number: num || id };
}

function pickStockQuantity(row: Record<string, unknown>): number {
  const raw =
    row.ONHAND ??
    row.onHand ??
    row.Quantity ??
    row.quantity ??
    row.stockQuantity;
  return Math.max(0, Math.round(Number(raw ?? 0)));
}

function pickUnitRef(row: Record<string, unknown>): number {
  const units = row.units ?? row.Units;
  if (Array.isArray(units) && units.length > 0 && isRecord(units[0])) {
    const ref = pickLogicalRef(units[0]);
    if (ref !== null) {
      return ref;
    }
  }
  const direct = row.unitRef ?? row.UnitRef ?? row.MAINUNIT ?? 1;
  const num = Number(direct);
  return Number.isFinite(num) ? num : 1;
}

@Injectable()
export class LogoTigerErpAdapter implements IErpAdapter, ErpStockCapableAdapter {
  readonly erpType = LOGO_PLATFORM_KEY;
  private readonly logger = new Logger(LogoTigerErpAdapter.name);

  constructor(private readonly http: ErpRestHttpService) {}

  private async client(credentials: Record<string, string>): Promise<AxiosInstance> {
    return this.http.createLogoTigerClient(credentials, LOGO_REST_API_PATH);
  }

  private async apiGet<T>(
    credentials: Record<string, string>,
    organizationId: string,
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const client = await this.client(credentials);
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
    const client = await this.client(credentials);
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
        $filter: 'IsActive eq true',
        $top: 1,
        $skip: 0,
      });
      const rows = rowsFromPayload(data);
      return {
        success: true,
        companyName: credentials.companyName ?? credentials.firmNo,
        version: 'tiger-rest-v1',
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

    for (let page = 0; page < 100; page += 1) {
      const data = await this.apiGet<unknown>(credentials, orgId, '/items', {
        $filter: 'IsActive eq true',
        $top: LOGO_ITEMS_PAGE_SIZE,
        $skip: page * LOGO_ITEMS_PAGE_SIZE,
      });
      const rows = rowsFromPayload(data);
      if (rows.length === 0) {
        break;
      }
      for (const row of rows) {
        const code = pickCode(row);
        if (!code) {
          continue;
        }
        const ref = pickLogicalRef(row);
        out.push({
          erpProductId: ref !== null ? String(ref) : code,
          barcode: (
            typeof row.BARCODE === 'string'
              ? row.BARCODE
              : typeof row.barcode === 'string'
                ? row.barcode
                : code
          ).trim(),
          name: pickName(row, code),
          stockQuantity: pickStockQuantity(row),
          purchasePrice:
            row.SALESPRICE !== undefined
              ? Number(row.SALESPRICE)
              : row.salesPrice !== undefined
                ? Number(row.salesPrice)
                : undefined,
        });
      }
      if (rows.length < LOGO_ITEMS_PAGE_SIZE) {
        break;
      }
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
    const itemData = await this.apiGet<unknown>(
      credentials,
      orgId,
      `/items/${productId}`,
    );
    const row = isRecord(itemData) ? itemData : rowsFromPayload(itemData)[0];
    if (!row) {
      throw new Error(`Logo Tiger: ürün bulunamadı (${productId})`);
    }
    const unitRef = pickUnitRef(row);
    await this.apiWrite(credentials, orgId, 'PATCH', `/items/${productId}/units/${unitRef}`, {
      Quantity: quantity,
    });
  }

  private async findItemByCode(
    credentials: Record<string, string>,
    orgId: string,
    code: string,
  ): Promise<{ itemRef: number; unitRef: number } | null> {
    const data = await this.apiGet<unknown>(credentials, orgId, '/items', {
      $filter: `Code eq '${code.replace(/'/g, "''")}'`,
      $top: 1,
    });
    const rows = rowsFromPayload(data);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    const itemRef = pickLogicalRef(row);
    if (itemRef === null) {
      return null;
    }
    return { itemRef, unitRef: pickUnitRef(row) };
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: ErpInvoiceInput,
  ): Promise<ErpInvoice> {
    const orgId = credentials.organizationId ?? 'global';
    const today = todayIsoDate();
    const customerCode = sanitizeCustomerCode(invoice.orderRef);

    const lines: Array<{
      ItemCode: string;
      Quantity: number;
      Price: number;
      VatRate: number;
    }> = [];

    for (const line of invoice.lines) {
      const sku = (line.sku ?? line.description).trim();
      const existing = await this.findItemByCode(credentials, orgId, sku);
      if (!existing) {
        await this.apiWrite(credentials, orgId, 'POST', '/items', {
          Code: sku,
          Name: line.description.slice(0, 200),
          IsActive: true,
        });
      }
      lines.push({
        ItemCode: sku,
        Quantity: line.quantity,
        Price: line.unitPrice,
        VatRate: line.taxRate,
      });
    }

    const invData = await this.apiWrite<unknown>(credentials, orgId, 'POST', '/invoices', {
      Date: today,
      ArpCode: customerCode,
      Description: invoice.customerName?.trim() || customerCode,
      Currency: invoice.currency,
      Total: invoice.totalAmount,
      Lines: lines,
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
      const data = await this.apiGet<unknown>(credentials, orgId, '/dispatchorders', {
        $filter: `Date ge ${dateFilter}`,
        $top: 200,
      });
      const rows = rowsFromPayload(data);
      return rows.map((row, i) => {
        const ref = pickLogicalRef(row);
        const id = ref !== null ? String(ref) : `row-${i}`;
        const issued =
          typeof row.Date === 'string'
            ? row.Date.slice(0, 10)
            : typeof row.date === 'string'
              ? row.date.slice(0, 10)
              : dateFilter;
        return {
          erpInvoiceId: id,
          orderRef: pickCode(row) || id,
          invoiceNumber: pickCode(row) || id,
          totalAmount: Number(row.Total ?? row.total ?? row.Amount ?? 0),
          currency: typeof row.Currency === 'string' ? row.Currency : 'TRY',
          issuedAt: issued,
          lines: [],
        };
      });
    } catch (error) {
      this.logger.warn('Logo Tiger sipariş listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }
}
