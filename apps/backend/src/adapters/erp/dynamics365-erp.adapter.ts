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
} from './erp-adapter.utils';

function resolveBase(credentials: Record<string, string>): string {
  const raw = credentials.baseUrl?.trim();
  if (raw) {
    return normalizeBaseUrl(raw);
  }
  const tenantId = credentials.tenantId?.trim();
  const environment = credentials.environment?.trim() ?? 'production';
  if (!tenantId) {
    throw new Error('Dynamics 365: tenantId veya baseUrl zorunludur');
  }
  return `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environment}/api/v2.0`;
}

@Injectable()
export class Dynamics365ErpAdapter implements IErpAdapter {
  readonly erpType = 'DYNAMICS365';
  private readonly logger = new Logger(Dynamics365ErpAdapter.name);

  private companyPath(credentials: Record<string, string>): string {
    const companyId = credentials.companyId?.trim();
    if (!companyId) {
      throw new Error('Dynamics 365: companyId zorunludur');
    }
    return `/companies(${companyId})`;
  }

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    const tenantId = credentials.tenantId?.trim();
    if (!clientId || !clientSecret || !tenantId) {
      throw new Error('Dynamics 365: clientId, clientSecret ve tenantId zorunludur');
    }
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const token = await getOAuth2ClientCredentialsToken(
      `${tokenUrl}\0${clientId}`,
      tokenUrl,
      clientId,
      clientSecret,
      'https://api.businesscentral.dynamics.com/.default',
    );
    return axios.create({
      baseURL: resolveBase(credentials),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = await this.getClient(credentials);
    const prefix = this.companyPath(credentials);
    const data = await client.get<unknown>(`${prefix}/items`, {
      params: { $top: 500 },
    });
    const rows = normalizeArrayPayload(data.data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.id ?? p.number ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.gtin ?? p.number ?? id),
        name: String(p.displayName ?? p.description ?? id),
        stockQuantity: Math.max(0, Math.round(Number(p.inventory ?? p.quantityOnHand ?? 0))),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    const client = await this.getClient(credentials);
    const prefix = this.companyPath(credentials);
    for (const item of items) {
      await client.patch(`${prefix}/items(${item.erpProductId})`, {
        inventory: item.quantity,
      });
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpOrder[]> {
    const client = await this.getClient(credentials);
    const prefix = this.companyPath(credentials);
    const params: Record<string, string> = { $top: '200' };
    if (since) {
      params.$filter = `orderDate ge ${since.toISOString()}`;
    }
    const { data } = await client.get<unknown>(`${prefix}/salesOrders`, { params });
    const rows = normalizeArrayPayload(data);
    return rows.map((row, i) => {
      const o = isRecord(row) ? row : {};
      const id = String(o.id ?? `order-${i}`);
      return {
        erpOrderId: id,
        orderRef: String(o.number ?? id),
        status: String(o.status ?? 'unknown'),
        totalAmount: Number(o.totalAmountIncludingTax ?? o.amount ?? 0),
        currency: String(o.currencyCode ?? 'TRY'),
        createdAt: String(o.orderDate ?? new Date().toISOString()),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = await this.getClient(credentials);
      await client.get(`${this.companyPath(credentials)}/items`, {
        params: { $top: 1 },
        timeout: 12_000,
      });
      return true;
    } catch (error) {
      this.logger.warn('Dynamics 365 bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      return await this.fetchInventory(credentials);
    } catch (error) {
      this.logger.warn('Dynamics 365 ürün listesi alınamadı', {
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
    const prefix = this.companyPath(credentials);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await client.post<{ id?: string; number?: string }>(
      `${prefix}/salesInvoices`,
      {
        externalDocumentNumber: invoice.orderRef,
        currencyCode: invoice.currency,
        invoiceDate: today,
        lines: invoice.lines,
      },
    );
    return {
      erpInvoiceId: String(data.id ?? 'unknown'),
      orderRef: invoice.orderRef,
      invoiceNumber: String(data.number ?? data.id ?? invoice.orderRef),
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
