import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import type { ErpInventoryPushItem, ErpOrder } from './erp-adapter.types';
import {
  mapRowsToErpProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
  stubInvoice,
} from './erp-adapter.utils';

/**
 * Sage 50 — on-premise stub; gerçek entegrasyon için API URL + key ile genişletilir.
 */
@Injectable()
export class Sage50ErpAdapter implements IErpAdapter {
  readonly erpType = 'SAGE50';
  private readonly logger = new Logger(Sage50ErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim();
    const baseUrl = credentials.baseUrl?.trim();
    if (!apiKey || !baseUrl) {
      throw new Error('Sage 50: baseUrl ve apiKey zorunludur');
    }
    return axios.create({
      baseURL: normalizeBaseUrl(baseUrl),
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
    const { data } = await client.get<unknown>('/items', { params: { limit: 500 } });
    const rows = normalizeArrayPayload(data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.id ?? p.code ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.barcode ?? id),
        name: String(p.name ?? id),
        stockQuantity: Math.max(0, Math.round(Number(p.stock ?? 0))),
      };
    });
  }

  async pushInventory(
    _credentials: Record<string, string>,
    _items: ErpInventoryPushItem[],
  ): Promise<void> {
    this.logger.warn('Sage 50 stok güncelleme stub — on-premise köprü gerekir');
  }

  async fetchOrders(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpOrder[]> {
    return [];
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = this.getClient(credentials);
      await client.get('/health', { timeout: 8_000, validateStatus: () => true });
      return true;
    } catch (error) {
      this.logger.warn('Sage 50 bağlantı testi (stub)', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return Boolean(credentials.baseUrl?.trim() && credentials.apiKey?.trim());
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch {
      return [];
    }
  }

  async createInvoice(
    _credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    return stubInvoice(invoice);
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}
