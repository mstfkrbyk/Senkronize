import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { buildOAuth1AuthorizationHeader } from '../../../common/oauth/oauth1-client';
import { axiosWithRetry } from '../../../common/utils/http-retry';
import type { ErpInventoryPushItem, ErpOrder } from '../erp-adapter.types';
import {
  isRecord,
  mapRowsToErpProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
  runErpConnectionTest,
} from '../erp-adapter.utils';

interface NetSuiteCredentials {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  baseUrl: string;
}

function resolveCredentials(
  credentials: Record<string, string>,
): NetSuiteCredentials {
  const accountId = credentials.accountId?.trim();
  const consumerKey =
    credentials.consumerKey?.trim() ?? credentials.clientId?.trim();
  const consumerSecret =
    credentials.consumerSecret?.trim() ?? credentials.clientSecret?.trim();
  const tokenId =
    credentials.tokenId?.trim() ??
    credentials.accessToken?.trim() ??
    credentials.token?.trim();
  const tokenSecret =
    credentials.tokenSecret?.trim() ?? credentials.accessTokenSecret?.trim();
  if (!consumerKey || !consumerSecret || !tokenId || !tokenSecret) {
    throw new Error(
      'NetSuite: consumerKey, consumerSecret, tokenId ve tokenSecret zorunludur',
    );
  }
  const rawBase = credentials.baseUrl?.trim();
  const baseUrl = rawBase
    ? normalizeBaseUrl(rawBase)
    : accountId
      ? `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1`
      : '';
  if (!baseUrl) {
    throw new Error('NetSuite: accountId veya baseUrl zorunludur');
  }
  return {
    accountId: accountId ?? '',
    consumerKey,
    consumerSecret,
    tokenId,
    tokenSecret,
    baseUrl,
  };
}

@Injectable()
export class NetsuiteErpAdapter implements IErpAdapter {
  readonly erpType = 'NETSUITE';
  private readonly logger = new Logger(NetsuiteErpAdapter.name);

  private buildClient(creds: NetSuiteCredentials): AxiosInstance {
    const instance = axios.create({
      baseURL: creds.baseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json', Prefer: 'transient' },
    });

    instance.interceptors.request.use((config) => {
      const method = (config.method ?? 'get').toUpperCase();
      const path = config.url ?? '';
      const base = (config.baseURL ?? creds.baseUrl).replace(/\/+$/, '');
      const query =
        config.params && typeof config.params === 'object'
          ? new URLSearchParams(
              Object.entries(config.params as Record<string, string>).map(
                ([k, v]) => [k, String(v)],
              ),
            ).toString()
          : '';
      const url = query.length > 0 ? `${base}${path}?${query}` : `${base}${path}`;
      config.headers.Authorization = buildOAuth1AuthorizationHeader(method, url, {
        consumerKey: creds.consumerKey,
        consumerSecret: creds.consumerSecret,
        tokenId: creds.tokenId,
        tokenSecret: creds.tokenSecret,
        realm: creds.accountId || undefined,
        signatureMethod: 'HMAC-SHA256',
      });
      return config;
    });

    return instance;
  }

  private getClient(credentials: Record<string, string>): AxiosInstance {
    return this.buildClient(resolveCredentials(credentials));
  }

  async fetchInventory(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = this.getClient(credentials);
    const data = await axiosWithRetry<unknown>(
      {
        method: 'GET',
        url: '/inventoryitem',
        baseURL: client.defaults.baseURL,
        headers: client.defaults.headers as Record<string, string>,
        params: { limit: 500 },
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
    const rows = normalizeArrayPayload(data);
    return mapRowsToErpProducts(rows, (p, i) => {
      const id = String(p.id ?? p.internalId ?? `row-${i}`);
      return {
        erpProductId: id,
        barcode: String(p.itemid ?? p.itemId ?? p.sku ?? id),
        name: String(p.displayname ?? p.displayName ?? p.itemid ?? id),
        stockQuantity: Math.max(
          0,
          Math.round(Number(p.quantityonhand ?? p.quantityOnHand ?? p.stock ?? 0)),
        ),
      };
    });
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    const subsidiaryId = credentials.subsidiaryId?.trim();
    const adjustmentAccountId = credentials.adjustmentAccountId?.trim();
    if (!subsidiaryId || !adjustmentAccountId) {
      for (const item of items) {
        await client.patch(`/inventoryitem/${item.erpProductId}`, {
          quantityonhand: item.quantity,
        });
      }
      return;
    }
    for (const item of items) {
      await client.post('/inventoryadjustment', {
        subsidiary: { id: subsidiaryId },
        account: { id: adjustmentAccountId },
        inventory: {
          items: [
            {
              item: { id: item.erpProductId },
              adjustqtyby: item.quantity,
            },
          ],
        },
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
      params.q = `createdDate AFTER "${since.toISOString().split('T')[0]}"`;
    }
    const data = await axiosWithRetry<unknown>(
      {
        method: 'GET',
        url: '/salesorder',
        baseURL: client.defaults.baseURL,
        headers: client.defaults.headers as Record<string, string>,
        params,
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
        orderRef: String(o.tranid ?? o.tranId ?? o.orderNumber ?? id),
        status: String(o.status ?? o.orderStatus ?? 'unknown'),
        totalAmount: Number(o.total ?? o.amount ?? 0),
        currency: String(o.currency ?? 'USD'),
        createdAt: String(
          o.createddate ?? o.createdDate ?? o.trandate ?? new Date().toISOString(),
        ),
      };
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    return runErpConnectionTest(async () => {
      const products = await this.fetchInventory(credentials);
      const creds = resolveCredentials(credentials);
      return {
        productCount: products.length,
        companyName: creds.accountId || undefined,
        version: 'rest-oauth1',
      };
    });
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

  private async resolveItemId(
    client: AxiosInstance,
    sku: string,
  ): Promise<string | null> {
    const data = await axiosWithRetry<unknown>(
      {
        method: 'GET',
        url: '/inventoryitem',
        baseURL: client.defaults.baseURL,
        headers: client.defaults.headers as Record<string, string>,
        params: { q: `itemid IS "${sku}"`, limit: 1 },
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
    const rows = normalizeArrayPayload(data);
    const first = rows[0];
    if (!isRecord(first)) {
      return null;
    }
    const id = first.id ?? first.internalId;
    return typeof id === 'string' ? id : null;
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = this.getClient(credentials);
    const today = new Date().toISOString().split('T')[0];
    const customerId = credentials.customerId?.trim() ?? invoice.orderRef;

    const lineItems = await Promise.all(
      invoice.lines.map(async (line) => {
        const itemId =
          (await this.resolveItemId(client, line.description)) ?? line.description;
        return {
          item: { id: itemId },
          quantity: line.quantity,
          rate: line.unitPrice,
        };
      }),
    );

    const { data } = await client.post<{ id?: string; tranid?: string; tranId?: string }>(
      '/salesorder',
      {
        entity: { id: customerId },
        trandate: today,
        currency: invoice.currency,
        item: { items: lineItems },
      },
    );

    return {
      erpInvoiceId: String(data.id ?? 'unknown'),
      orderRef: invoice.orderRef,
      invoiceNumber: String(data.tranid ?? data.tranId ?? data.id ?? invoice.orderRef),
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
