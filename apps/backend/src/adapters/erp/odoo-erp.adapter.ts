import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios from 'axios';

import type { ErpInventoryPushItem, ErpOrder } from './erp-adapter.types';
import {
  isRecord,
  mapRowsToErpProducts,
  normalizeBaseUrl,
  stubInvoice,
} from './erp-adapter.utils';

function resolveRpcUrl(credentials: Record<string, string>): string {
  const raw = credentials.baseUrl?.trim();
  if (raw) {
    return normalizeBaseUrl(raw);
  }
  const instance = credentials.instance?.trim();
  if (!instance) {
    throw new Error('Odoo: instance veya baseUrl zorunludur');
  }
  const host = instance.includes('.') ? instance : `${instance}.odoo.com`;
  return `https://${host}/web/dataset/call_kw`;
}

@Injectable()
export class OdooErpAdapter implements IErpAdapter {
  readonly erpType = 'ODOO';
  private readonly logger = new Logger(OdooErpAdapter.name);

  private async callKw<T>(
    credentials: Record<string, string>,
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    const apiKey = credentials.apiKey?.trim();
    const db = credentials.db?.trim();
    const uid = credentials.uid?.trim();
    if (!apiKey || !db || !uid) {
      throw new Error('Odoo: apiKey, db ve uid zorunludur');
    }
    const url = resolveRpcUrl(credentials);
    const { data } = await axios.post<{ result?: T; error?: { message?: string } }>(
      url,
      {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [db, Number(uid), apiKey, model, method, args, kwargs],
        },
        id: Date.now(),
      },
      { timeout: 30_000, headers: { 'Content-Type': 'application/json' } },
    );
    if (data.error?.message) {
      throw new Error(data.error.message);
    }
    return data.result as T;
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const rows = await this.callKw<unknown[]>(credentials, 'product.product', 'search_read', [
      [],
      ['id', 'default_code', 'name', 'qty_available'],
    ]);
    const list = Array.isArray(rows) ? rows : [];
    return mapRowsToErpProducts(list, (p, i) => {
      const id = String(p.id ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.default_code ?? id),
        name: String(p.name ?? id),
        stockQuantity: Math.max(0, Math.round(Number(p.qty_available ?? 0))),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    for (const item of items) {
      await this.callKw(credentials, 'product.product', 'write', [
        [Number(item.erpProductId)],
        { qty_available: item.quantity },
      ]);
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const domain: unknown[] = since ? [['date_order', '>=', since.toISOString()]] : [];
    const rows = await this.callKw<unknown[]>(
      credentials,
      'sale.order',
      'search_read',
      [domain, ['id', 'name', 'state', 'amount_total', 'currency_id', 'date_order']],
    );
    const list = Array.isArray(rows) ? rows : [];
    return list.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.id ?? `order-${i}`);
      const currencyField = o.currency_id;
      const currency = Array.isArray(currencyField)
        ? String(currencyField[1] ?? 'TRY')
        : 'TRY';
      return {
        erpOrderId: id,
        orderRef: String(o.name ?? id),
        status: String(o.state ?? 'unknown'),
        totalAmount: Number(o.amount_total ?? 0),
        currency,
        createdAt: String(o.date_order ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      await this.callKw<number>(credentials, 'product.product', 'search_count', [[]]);
      return { success: true };
    } catch (error) {
      this.logger.warn('Odoo bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn('Odoo ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const orderId = await this.callKw<number>(credentials, 'sale.order', 'create', [
      {
        name: invoice.orderRef,
        amount_total: invoice.totalAmount,
      },
    ]);
    const today = new Date().toISOString().split('T')[0];
    return {
      erpInvoiceId: String(orderId),
      orderRef: invoice.orderRef,
      invoiceNumber: String(orderId),
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
