import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { axiosWithRetry } from '../../common/utils/http-retry';
import type { ErpInventoryPushItem, ErpOrder } from './erp-adapter.types';
import {
  getOAuth2ClientCredentialsToken,
  isRecord,
  mapRowsToErpProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
  stubInvoice,
} from './erp-adapter.utils';

function resolveBase(credentials: Record<string, string>): string {
  const accountId = credentials.accountId?.trim();
  const raw = credentials.baseUrl?.trim();
  if (raw) {
    return normalizeBaseUrl(raw);
  }
  if (!accountId) {
    throw new Error('NetSuite: accountId veya baseUrl zorunludur');
  }
  return `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;
}

@Injectable()
export class NetsuiteErpAdapter implements IErpAdapter {
  readonly erpType = 'NETSUITE';
  private readonly logger = new Logger(NetsuiteErpAdapter.name);

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    const tokenUrl = credentials.tokenUrl?.trim();
    if (!clientId || !clientSecret || !tokenUrl) {
      throw new Error('NetSuite: clientId, clientSecret ve tokenUrl zorunludur');
    }
    const base = resolveBase(credentials);
    const token = await getOAuth2ClientCredentialsToken(
      `${tokenUrl}\0${clientId}`,
      tokenUrl,
      clientId,
      clientSecret,
      credentials.scope?.trim(),
    );
    return axios.create({
      baseURL: base,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = await this.getClient(credentials);
    const data = await axiosWithRetry<unknown>(
      { method: 'GET', url: `${client.defaults.baseURL}/inventoryItem`, timeout: 30_000, headers: client.defaults.headers as Record<string, string> },
      { maxRetries: 2 },
    );
    const rows = normalizeArrayPayload(data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.id ?? p.internalId ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.itemId ?? p.sku ?? id),
        name: String(p.displayName ?? p.itemId ?? id),
        stockQuantity: Math.max(0, Math.round(Number(p.quantityOnHand ?? p.stock ?? 0))),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    const client = await this.getClient(credentials);
    for (const item of items) {
      await client.patch(`/inventoryItem/${item.erpProductId}`, {
        quantityOnHand: item.quantity,
      });
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const client = await this.getClient(credentials);
    const params: Record<string, string> = {};
    if (since) {
      params.q = `createdDate AFTER "${since.toISOString().split('T')[0]}"`;
    }
    const data = await axiosWithRetry<unknown>(
      {
        method: 'GET',
        url: `${client.defaults.baseURL}/salesOrder`,
        params,
        headers: client.defaults.headers as Record<string, string>,
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
    const rows = normalizeArrayPayload(data);
    return rows.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.id ?? o.internalId ?? `order-${i}`);
      return {
        erpOrderId: id,
        orderRef: String(o.tranId ?? o.orderNumber ?? id),
        status: String(o.status ?? o.orderStatus ?? 'unknown'),
        totalAmount: Number(o.total ?? o.amount ?? 0),
        currency: String(o.currency ?? 'USD'),
        createdAt: String(o.createdDate ?? o.tranDate ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.fetchInventory(credentials);
      return true;
    } catch (error) {
      this.logger.warn('NetSuite bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn('NetSuite ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = await this.getClient(credentials);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await client.post<{ id?: string; tranId?: string }>('/salesOrder', {
      externalId: invoice.orderRef,
      currency: invoice.currency,
      total: invoice.totalAmount,
      item: invoice.lines,
    });
    return {
      erpInvoiceId: String(data.id ?? 'unknown'),
      orderRef: invoice.orderRef,
      invoiceNumber: String(data.tranId ?? data.id ?? invoice.orderRef),
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
