import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import type { ErpInventoryPushItem, ErpOrder } from './erp-adapter.types';
import {
  isRecord,
  mapRowsToErpProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
} from './erp-adapter.utils';

function resolveBase(credentials: Record<string, string>): string {
  const raw = credentials.baseUrl?.trim();
  if (raw) {
    return normalizeBaseUrl(raw);
  }
  const companyId = credentials.companyId?.trim();
  if (!companyId) {
    throw new Error('QuickBooks: companyId veya baseUrl zorunludur');
  }
  return `https://quickbooks.api.intuit.com/v3/company/${companyId}`;
}

@Injectable()
export class QuickbooksErpAdapter implements IErpAdapter {
  readonly erpType = 'QUICKBOOKS';
  private readonly logger = new Logger(QuickbooksErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken) {
      throw new Error('QuickBooks: accessToken zorunludur');
    }
    return axios.create({
      baseURL: resolveBase(credentials),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = this.getClient(credentials);
    const { data } = await client.get<unknown>('/query', {
      params: { query: 'SELECT * FROM Item MAXRESULTS 500' },
    });
    const envelope = isRecord(data) && isRecord(data.QueryResponse) ? data.QueryResponse : data;
    const rows = normalizeArrayPayload(envelope);
    const items = rows.length > 0 ? rows : normalizeArrayPayload((envelope as Record<string, unknown>).Item);
    return mapRowsToErpProducts(items, (p, i) => {
      const id = String(p.Id ?? p.id ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.Sku ?? p.sku ?? id),
        name: String(p.Name ?? p.name ?? id),
        stockQuantity: Math.max(0, Math.round(Number(p.QtyOnHand ?? p.quantity ?? 0))),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const item of items) {
      await client.post('/item', {
        Id: item.erpProductId,
        QtyOnHand: item.quantity,
        sparse: true,
      });
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const client = this.getClient(credentials);
    let query = 'SELECT * FROM Invoice MAXRESULTS 200';
    if (since) {
      query = `SELECT * FROM Invoice WHERE TxnDate >= '${since.toISOString().split('T')[0]}' MAXRESULTS 200`;
    }
    const { data } = await client.get<unknown>('/query', { params: { query } });
    const envelope = isRecord(data) && isRecord(data.QueryResponse) ? data.QueryResponse : data;
    const rows = normalizeArrayPayload((envelope as Record<string, unknown>).Invoice ?? envelope);
    return rows.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.Id ?? `order-${i}`);
      return {
        erpOrderId: id,
        orderRef: String(o.DocNumber ?? id),
        status: String(o.EmailStatus ?? o.status ?? 'unknown'),
        totalAmount: Number(o.TotalAmt ?? 0),
        currency:
          isRecord(o.CurrencyRef) && typeof o.CurrencyRef.value === 'string'
            ? o.CurrencyRef.value
            : 'USD',
        createdAt: String(o.TxnDate ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = this.getClient(credentials);
      await client.get('/companyinfo/1');
      return { success: true };
    } catch (error) {
      this.logger.warn('QuickBooks bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn('QuickBooks ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = this.getClient(credentials);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await client.post<{ Invoice?: { Id?: string; DocNumber?: string } }>(
      '/invoice',
      {
        DocNumber: invoice.orderRef,
        TxnDate: today,
        TotalAmt: invoice.totalAmount,
        CurrencyRef: { value: invoice.currency },
        Line: invoice.lines.map((l) => ({
          Description: l.description,
          Amount: l.total,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            Qty: l.quantity,
            UnitPrice: l.unitPrice,
          },
        })),
      },
    );
    const inv = data.Invoice ?? {};
    const id = String(inv.Id ?? 'unknown');
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: String(inv.DocNumber ?? id),
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
    const orders = await this.fetchOrders(credentials, since);
    return orders.map((o) => ({
      erpInvoiceId: o.erpOrderId,
      orderRef: o.orderRef,
      invoiceNumber: o.orderRef,
      totalAmount: o.totalAmount,
      currency: o.currency,
      issuedAt: o.createdAt.split('T')[0],
      lines: [],
    }));
  }
}
