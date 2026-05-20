import { Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import type { ErpInventoryPushItem, ErpOrder } from './erp-adapter.types';
import {
  isRecord,
  mapRowsToErpProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
} from './erp-adapter.utils';

export interface OAuth2ErpAdapterConfig {
  erpType: string;
  label: string;
  defaultBaseUrl: string;
  authHeaderPrefix?: 'Bearer' | 'Zoho-oauthtoken';
  extraHeaders?: (credentials: Record<string, string>) => Record<string, string>;
  extraParams?: (credentials: Record<string, string>) => Record<string, string>;
}

export abstract class OAuth2ErpAdapterBase implements IErpAdapter {
  abstract readonly config: OAuth2ErpAdapterConfig;
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
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken) {
      throw new Error(`${this.config.label}: accessToken zorunludur`);
    }
    const prefix = this.config.authHeaderPrefix ?? 'Bearer';
    const authValue =
      prefix === 'Zoho-oauthtoken' ? `${prefix} ${accessToken}` : `Bearer ${accessToken}`;
    const base = normalizeBaseUrl(
      credentials.baseUrl?.trim() || this.config.defaultBaseUrl,
    );
    return axios.create({
      baseURL: base,
      headers: {
        Authorization: authValue,
        'Content-Type': 'application/json',
        ...this.config.extraHeaders?.(credentials),
      },
      timeout: 30_000,
    });
  }

  protected orderParams(
    credentials: Record<string, string>,
    since?: Date,
  ): Record<string, string> {
    const params: Record<string, string> = { limit: '200', ...this.config.extraParams?.(credentials) };
    if (since) {
      params.since = since.toISOString();
    }
    return params;
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = this.getClient(credentials);
    const { data } = await client.get<unknown>('/items', {
      params: this.config.extraParams?.(credentials),
    });
    const rows = normalizeArrayPayload(data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.item_id ?? p.id ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.sku ?? p.code ?? id),
        name: String(p.name ?? id),
        stockQuantity: Math.max(0, Math.round(Number(p.stock_on_hand ?? p.quantity ?? 0))),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const item of items) {
      await client.put(`/items/${item.erpProductId}`, {
        stock_on_hand: item.quantity,
      });
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const client = this.getClient(credentials);
    const { data } = await client.get<unknown>('/invoices', {
      params: this.orderParams(credentials, since),
    });
    const rows = normalizeArrayPayload(data);
    return rows.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.invoice_id ?? o.id ?? `order-${i}`);
      return {
        erpOrderId: id,
        orderRef: String(o.invoice_number ?? o.reference ?? id),
        status: String(o.status ?? 'unknown'),
        totalAmount: Number(o.total ?? o.amount ?? 0),
        currency: String(o.currency_code ?? o.currency ?? 'USD'),
        createdAt: String(o.date ?? o.created_at ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = this.getClient(credentials);
      await client.get('/organizations', {
        params: this.config.extraParams?.(credentials),
        timeout: 12_000,
      });
      return { success: true };
    } catch (error) {
      this.logger.warn(`${this.config.label} bağlantı testi başarısız`, {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
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
    const { data } = await client.post<{ invoice_id?: string; invoice_number?: string }>(
      '/invoices',
      {
        reference_number: invoice.orderRef,
        date: today,
        total: invoice.totalAmount,
        currency_code: invoice.currency,
        line_items: invoice.lines,
      },
      { params: this.config.extraParams?.(credentials) },
    );
    const id = String(data.invoice_id ?? 'unknown');
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: String(data.invoice_number ?? id),
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
