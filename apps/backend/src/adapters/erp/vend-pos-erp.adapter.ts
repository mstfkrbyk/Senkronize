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
  const domainPrefix = credentials.domainPrefix?.trim() ?? credentials.domain_prefix?.trim();
  if (!domainPrefix) {
    throw new Error('Vend POS: domainPrefix veya baseUrl zorunludur');
  }
  return `https://${domainPrefix}.vendhq.com/api/2.0`;
}

@Injectable()
export class VendPosErpAdapter implements IErpAdapter {
  readonly erpType = 'VEND_POS';
  private readonly logger = new Logger(VendPosErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken) {
      throw new Error('Vend POS: accessToken zorunludur');
    }
    return axios.create({
      baseURL: resolveBase(credentials),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = this.getClient(credentials);
    const { data } = await client.get<unknown>('/products', { params: { page_size: 200 } });
    const rows = normalizeArrayPayload(isRecord(data) ? data.data : data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.id ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.sku ?? p.handle ?? id),
        name: String(p.name ?? id),
        stockQuantity: Math.max(
          0,
          Math.round(Number(p.inventory_level ?? p.stock_level ?? 0)),
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
      await client.post(`/products/${item.erpProductId}/inventory`, {
        quantity: item.quantity,
      });
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const client = this.getClient(credentials);
    const params: Record<string, string> = { page_size: '200' };
    if (since) {
      params.since = since.toISOString();
    }
    const { data } = await client.get<unknown>('/sales', { params });
    const rows = normalizeArrayPayload(isRecord(data) ? data.data : data);
    return rows.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.id ?? `order-${i}`);
      return {
        erpOrderId: id,
        orderRef: String(o.invoice_number ?? o.receipt_number ?? id),
        status: String(o.status ?? 'unknown'),
        totalAmount: Number(o.total_price ?? o.total ?? 0),
        currency: String(o.currency ?? 'USD'),
        createdAt: String(o.created_at ?? o.sale_date ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = this.getClient(credentials);
      await client.get('/products', { params: { page_size: 1 }, timeout: 12_000 });
      return { success: true };
    } catch (error) {
      this.logger.warn('Vend POS bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn('Vend POS ürün listesi alınamadı', {
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
    const { data } = await client.post<{ data?: { id?: string; invoice_number?: string } }>(
      '/sales',
      {
        reference: invoice.orderRef,
        total_price: invoice.totalAmount,
      },
    );
    const sale = data.data ?? {};
    const id = String(sale.id ?? 'unknown');
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: String(sale.invoice_number ?? id),
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      issuedAt: today,
      lines: invoice.lines,
    };
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}
