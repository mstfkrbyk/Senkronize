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

const IQRA_DEFAULT_BASE = 'https://api.iqra.com.tr/v1';

@Injectable()
export class IqraErpAdapter implements IErpAdapter {
  readonly erpType = 'IQRA_ERP';
  private readonly logger = new Logger(IqraErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      throw new Error('IQRA ERP: apiKey zorunludur');
    }
    const base = normalizeBaseUrl(credentials.baseUrl?.trim() || IQRA_DEFAULT_BASE);
    return axios.create({
      baseURL: base,
      headers: {
        'X-API-Key': apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = this.getClient(credentials);
    const { data } = await client.get<unknown>('/products', { params: { limit: 500 } });
    const rows = normalizeArrayPayload(data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.id ?? p.code ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.barcode ?? p.sku ?? id),
        name: String(p.name ?? id),
        stockQuantity: Math.max(0, Math.round(Number(p.stock ?? p.quantity ?? 0))),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const item of items) {
      await client.put(`/products/${item.erpProductId}/stock`, { quantity: item.quantity });
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const client = this.getClient(credentials);
    const params: Record<string, string> = { limit: '200' };
    if (since) {
      params.since = since.toISOString();
    }
    const { data } = await client.get<unknown>('/orders', { params });
    const rows = normalizeArrayPayload(data);
    return rows.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.id ?? `order-${i}`);
      return {
        erpOrderId: id,
        orderRef: String(o.reference ?? o.orderNumber ?? id),
        status: String(o.status ?? 'unknown'),
        totalAmount: Number(o.total ?? o.amount ?? 0),
        currency: String(o.currency ?? 'TRY'),
        createdAt: String(o.createdAt ?? o.date ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = this.getClient(credentials);
      await client.get('/products', { params: { limit: 1 }, timeout: 12_000 });
      return { success: true };
    } catch (error) {
      this.logger.warn('IQRA ERP bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn('IQRA ERP ürün listesi alınamadı', {
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
    const { data } = await client.post<{ id?: string; number?: string }>('/invoices', {
      reference: invoice.orderRef,
      total: invoice.totalAmount,
      currency: invoice.currency,
      lines: invoice.lines,
    });
    const id = String(data.id ?? 'unknown');
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: String(data.number ?? id),
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
