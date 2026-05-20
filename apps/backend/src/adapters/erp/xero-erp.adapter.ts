import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import type { ErpInventoryPushItem, ErpOrder } from './erp-adapter.types';
import {
  isRecord,
  mapRowsToErpProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
} from './erp-adapter.utils';

const XERO_DEFAULT_BASE = 'https://api.xero.com/api.xro/2.0';

@Injectable()
export class XeroErpAdapter implements IErpAdapter {
  readonly erpType = 'XERO';
  private readonly logger = new Logger(XeroErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const accessToken = credentials.accessToken?.trim();
    const tenantId = credentials.tenantId?.trim();
    if (!accessToken || !tenantId) {
      throw new Error('Xero: accessToken ve tenantId zorunludur');
    }
    const base = normalizeBaseUrl(credentials.baseUrl?.trim() || XERO_DEFAULT_BASE);
    return axios.create({
      baseURL: base,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = this.getClient(credentials);
    const { data } = await client.get<unknown>('/Items');
    const rows = normalizeArrayPayload(isRecord(data) ? data.Items : data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.ItemID ?? p.itemID ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.Code ?? p.code ?? id),
        name: String(p.Name ?? p.name ?? id),
        stockQuantity: Math.max(
          0,
          Math.round(Number(p.QuantityOnHand ?? p.quantityOnHand ?? 0)),
        ),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const item of items) {
      await client.post('/Items', {
        ItemID: item.erpProductId,
        QuantityOnHand: item.quantity,
      });
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const client = this.getClient(credentials);
    const params: Record<string, string> = {};
    if (since) {
      params.where = `Date>=DateTime(${since.getUTCFullYear()},${since.getUTCMonth() + 1},${since.getUTCDate()})`;
    }
    const { data } = await client.get<unknown>('/Invoices', { params });
    const rows = normalizeArrayPayload(isRecord(data) ? data.Invoices : data);
    return rows.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.InvoiceID ?? `order-${i}`);
      return {
        erpOrderId: id,
        orderRef: String(o.InvoiceNumber ?? id),
        status: String(o.Status ?? 'unknown'),
        totalAmount: Number(o.Total ?? 0),
        currency: String(o.CurrencyCode ?? 'USD'),
        createdAt: String(o.Date ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = this.getClient(credentials);
      await client.get('/Organisation');
      return true;
    } catch (error) {
      this.logger.warn('Xero bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn('Xero ürün listesi alınamadı', {
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
    const { data } = await client.post<{ Invoices?: Array<{ InvoiceID?: string; InvoiceNumber?: string }> }>(
      '/Invoices',
      {
        Invoices: [
          {
            Type: 'ACCREC',
            Contact: { Name: invoice.orderRef },
            Date: today,
            LineItems: invoice.lines.map((l) => ({
              Description: l.description,
              Quantity: l.quantity,
              UnitAmount: l.unitPrice,
              TaxAmount: l.total - l.quantity * l.unitPrice,
              LineAmount: l.total,
            })),
          },
        ],
      },
    );
    const created = data.Invoices?.[0];
    const id = String(created?.InvoiceID ?? 'unknown');
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: String(created?.InvoiceNumber ?? id),
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
