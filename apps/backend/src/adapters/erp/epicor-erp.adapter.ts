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
  const server = credentials.server?.trim();
  const company = credentials.company?.trim();
  if (!server || !company) {
    throw new Error('Epicor: server ve company veya baseUrl zorunludur');
  }
  return `https://${server}/api/v2/odata/${company}`;
}

@Injectable()
export class EpicorErpAdapter implements IErpAdapter {
  readonly erpType = 'EPICOR';
  private readonly logger = new Logger(EpicorErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      throw new Error('Epicor: apiKey zorunludur');
    }
    return axios.create({
      baseURL: resolveBase(credentials),
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = this.getClient(credentials);
    const { data } = await client.get<unknown>('/Parts', { params: { $top: 500 } });
    const rows = normalizeArrayPayload(data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.PartNum ?? p.id ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.PartNum ?? id),
        name: String(p.PartDescription ?? p.Description ?? id),
        stockQuantity: Math.max(0, Math.round(Number(p.OnHandQty ?? p.QtyOnHand ?? 0))),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const item of items) {
      await client.patch(`/Parts('${item.erpProductId}')`, { OnHandQty: item.quantity });
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const client = this.getClient(credentials);
    const params: Record<string, string> = { $top: '200' };
    if (since) {
      params.$filter = `OrderDate ge ${since.toISOString()}`;
    }
    const { data } = await client.get<unknown>('/OrderHed', { params });
    const rows = normalizeArrayPayload(data);
    return rows.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.OrderNum ?? o.id ?? `order-${i}`);
      return {
        erpOrderId: id,
        orderRef: String(o.PONum ?? o.OrderNum ?? id),
        status: String(o.OrderStatus ?? 'unknown'),
        totalAmount: Number(o.DocTotal ?? o.TotalCharges ?? 0),
        currency: String(o.CurrencyCode ?? 'USD'),
        createdAt: String(o.OrderDate ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = this.getClient(credentials);
      await client.get('/Parts', { params: { $top: 1 }, timeout: 12_000 });
      return { success: true };
    } catch (error) {
      this.logger.warn('Epicor bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn('Epicor ürün listesi alınamadı', {
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
    const { data } = await client.post<{ OrderNum?: string }>('/OrderHed', {
      PONum: invoice.orderRef,
      DocTotal: invoice.totalAmount,
    });
    const id = String(data.OrderNum ?? invoice.orderRef);
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: id,
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
