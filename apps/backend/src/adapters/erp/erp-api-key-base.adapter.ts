import { Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import type { ErpInventoryPushItem, ErpOrder } from './erp-adapter.types';
import {
  isRecord,
  mapRowsToErpProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
} from './erp-adapter.utils';

export interface ApiKeyErpAdapterConfig {
  erpType: string;
  label: string;
  defaultBaseUrl: string;
  requireApiKey?: boolean;
}

export abstract class ApiKeyErpAdapterBase implements IErpAdapter {
  abstract readonly config: ApiKeyErpAdapterConfig;
  private _logger?: Logger;

  protected get logger(): Logger {
    if (!this._logger) {
      this._logger = new Logger(this.config.label);
    }
    return this._logger;
  }

  get erpType(): string {
    return this.config.erpType;
  }

  protected getClient(credentials: Record<string, string>): AxiosInstance {
    const requireKey = this.config.requireApiKey !== false;
    const apiKey = credentials.apiKey?.trim();
    if (requireKey && !apiKey) {
      throw new Error(`${this.config.label}: apiKey zorunludur`);
    }
    const base = normalizeBaseUrl(
      credentials.baseUrl?.trim() || this.config.defaultBaseUrl,
    );
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
      headers.Authorization = `Bearer ${apiKey}`;
    }
    return axios.create({
      baseURL: base,
      headers,
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
      await client.put(`/products/${item.erpProductId}/stock`, {
        quantity: item.quantity,
      });
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

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = this.getClient(credentials);
      await client.get('/products', { params: { limit: 1 }, timeout: 12_000 });
      return true;
    } catch (error) {
      this.logger.warn(`${this.config.label} bağlantı testi başarısız`, {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn(`${this.config.label} ürün listesi alınamadı`, {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    try {
      return await this.fetchOrders(credentials, since);
    } catch (error) {
      this.logger.warn(`${this.config.label} sipariş listesi alınamadı`, {
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
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpInvoice[]> {
    try {
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
    } catch (error) {
      this.logger.warn(`${this.config.label} fatura listesi alınamadı`, {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }
}
