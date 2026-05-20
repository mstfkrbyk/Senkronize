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
  const accountId = credentials.accountId?.trim() ?? credentials.accountID?.trim();
  if (!accountId) {
    throw new Error('Lightspeed: accountId veya baseUrl zorunludur');
  }
  return `https://api.lightspeedapp.com/API/V3/Account/${accountId}`;
}

@Injectable()
export class LightspeedErpAdapter implements IErpAdapter {
  readonly erpType = 'LIGHTSPEED';
  private readonly logger = new Logger(LightspeedErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken) {
      throw new Error('Lightspeed: accessToken zorunludur');
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
    const { data } = await client.get<unknown>('/Inventory.json');
    const rows = normalizeArrayPayload(isRecord(data) ? data.Inventory : data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.itemID ?? p.id ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.systemSku ?? p.customSku ?? id),
        name: String(p.description ?? p.name ?? id),
        stockQuantity: Math.max(0, Math.round(Number(p.qoh ?? p.quantity ?? 0))),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const item of items) {
      await client.put(`/Inventory/${item.erpProductId}.json`, { qoh: item.quantity });
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const client = this.getClient(credentials);
    const params: Record<string, string> = { limit: '200' };
    if (since) {
      params.timeStamp = `>,${since.toISOString()}`;
    }
    const { data } = await client.get<unknown>('/Sale.json', { params });
    const rows = normalizeArrayPayload(isRecord(data) ? data.Sale : data);
    return rows.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.saleID ?? o.id ?? `order-${i}`);
      return {
        erpOrderId: id,
        orderRef: String(o.ticketNumber ?? o.saleID ?? id),
        status: String(o.completed ?? o.status ?? 'unknown'),
        totalAmount: Number(o.total ?? o.calcTotal ?? 0),
        currency: String(o.currency ?? 'USD'),
        createdAt: String(o.createTime ?? o.timeStamp ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = this.getClient(credentials);
      await client.get('/Shop.json', { params: { limit: 1 }, timeout: 12_000 });
      return { success: true };
    } catch (error) {
      this.logger.warn('Lightspeed bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn('Lightspeed ürün listesi alınamadı', {
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
    const { data } = await client.post<{ Sale?: { saleID?: string } }>('/Sale.json', {
      referenceNumber: invoice.orderRef,
      total: invoice.totalAmount,
    });
    const id = String(data.Sale?.saleID ?? invoice.orderRef);
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
