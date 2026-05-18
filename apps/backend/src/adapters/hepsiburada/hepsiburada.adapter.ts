import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  HEPSIBURADA_INTEGRATION_ID,
  HEPSIBURADA_LISTING_BASE_URL,
  HEPSIBURADA_OMS_BASE_URL,
} from './hepsiburada.constants';
import type {
  HepsiburadaListingsResponse,
  HepsiburadaOmsLineItem,
  HepsiburadaOmsPaged,
} from './hepsiburada.types';

@Injectable()
export class HepsiburadaAdapter implements IMarketplaceAdapter {
  readonly platform: string = 'HEPSIBURADA';
  private readonly logger = new Logger(HepsiburadaAdapter.name);

  /** Premium / kurumsal kanallar için ek HTTP başlıkları (alt sınıflar override eder) */
  protected extraHttpHeaders(
    credentials: Record<string, string>,
  ): Record<string, string> {
    void credentials;
    return {};
  }

  private resolveMerchantId(credentials: Record<string, string>): string {
    const fromField =
      typeof credentials.merchantId === 'string' && credentials.merchantId.length > 0
        ? credentials.merchantId
        : null;
    const fromUser =
      typeof credentials.username === 'string' && credentials.username.length > 0
        ? credentials.username
        : null;
    return (fromField ?? fromUser ?? '').trim();
  }

  private getListingClient(
    username: string,
    password: string,
    credentials: Record<string, string>,
  ): AxiosInstance {
    return axios.create({
      baseURL: HEPSIBURADA_LISTING_BASE_URL,
      auth: { username, password },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Senkronize/${HEPSIBURADA_INTEGRATION_ID}`,
        ...this.extraHttpHeaders(credentials),
      },
      timeout: 30_000,
    });
  }

  private getOmsClient(
    username: string,
    password: string,
    credentials: Record<string, string>,
  ): AxiosInstance {
    return axios.create({
      baseURL: HEPSIBURADA_OMS_BASE_URL,
      auth: { username, password },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Senkronize/${HEPSIBURADA_INTEGRATION_ID}`,
        ...this.extraHttpHeaders(credentials),
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const username = credentials.username;
      const password = credentials.password;
      if (!username || !password) {
        return false;
      }
      const merchantId = this.resolveMerchantId(credentials);
      const client = this.getListingClient(username, password, credentials);
      const path =
        merchantId.length > 0
          ? `/listings/merchantid/${encodeURIComponent(merchantId)}/listings`
          : '/listings/merchantid/self/listings';
      await client.get(path, { params: { offset: 0, limit: 1 } });
      return true;
    } catch (error) {
      this.logger.warn('Hepsiburada bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const { username, password } = credentials;
    const merchantId = this.resolveMerchantId(credentials);
    if (!merchantId) {
      throw new Error('Hepsiburada merchantId veya username zorunlu');
    }
    const client = this.getOmsClient(username, password, credentials);
    return this.fetchOmsOrdersPaged(client, merchantId, since);
  }

  private async fetchOmsOrdersPaged(
    client: AxiosInstance,
    merchantId: string,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const limit = 100;
    let offset = 0;
    const allLines: HepsiburadaOmsLineItem[] = [];
    let total = Number.POSITIVE_INFINITY;

    const beginDate =
      since != null
        ? `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')} ${String(since.getHours()).padStart(2, '0')}:${String(since.getMinutes()).padStart(2, '0')}`
        : undefined;

    while (offset < total) {
      const params: Record<string, string> = {
        offset: String(offset),
        limit: String(limit),
      };
      if (beginDate) {
        params.begindate = beginDate;
      }

      const { data } = await client.get<unknown>(
        `/orders/merchantid/${encodeURIComponent(merchantId)}`,
        { params },
      );

      const page = this.parseOmsOrdersPage(data);
      allLines.push(...page.items);
      total = page.totalCount > 0 ? page.totalCount : allLines.length;
      offset += limit;

      if (page.items.length < limit) {
        break;
      }
    }

    return this.groupOmsLinesToOrders(allLines);
  }

  private parseOmsOrdersPage(data: unknown): HepsiburadaOmsPaged {
    if (!data || typeof data !== 'object') {
      return { items: [], totalCount: 0 };
    }
    const root = data as Record<string, unknown>;
    const body =
      root.items != null
        ? root
        : root.data != null && typeof root.data === 'object'
          ? (root.data as Record<string, unknown>)
          : null;
    if (!body || !Array.isArray(body.items)) {
      return { items: [], totalCount: 0 };
    }
    const items = body.items as HepsiburadaOmsLineItem[];
    const totalCount =
      typeof body.totalCount === 'number' && Number.isFinite(body.totalCount)
        ? body.totalCount
        : items.length;
    return { items, totalCount };
  }

  private groupOmsLinesToOrders(lines: HepsiburadaOmsLineItem[]): MarketplaceOrder[] {
    const byOrder = new Map<string, HepsiburadaOmsLineItem[]>();
    for (const line of lines) {
      const key =
        (typeof line.orderNumber === 'string' && line.orderNumber) ||
        (typeof line.orderId === 'string' && line.orderId) ||
        (typeof line.id === 'string' && line.id) ||
        'unknown';
      const list = byOrder.get(key) ?? [];
      list.push(line);
      byOrder.set(key, list);
    }

    const orders: MarketplaceOrder[] = [];
    for (const [, group] of byOrder) {
      if (group.length === 0) {
        continue;
      }
      const first = group[0];
      if (!first) {
        continue;
      }
      const platformOrderId =
        (typeof first.orderNumber === 'string' && first.orderNumber) ||
        (typeof first.orderId === 'string' && first.orderId) ||
        'unknown';
      let total = 0;
      let currency = 'TRY';
      for (const line of group) {
        total += moneyAmount(line.totalPrice);
        const c = line.totalPrice?.currency;
        if (typeof c === 'string' && c.length > 0) {
          currency = c;
        }
      }
      const dates = group
        .map((l) => l.orderDate)
        .filter((d): d is string => typeof d === 'string' && d.length > 0)
        .sort();
      orders.push({
        platformOrderId,
        status: typeof first.status === 'string' ? first.status : 'UNKNOWN',
        customerName:
          typeof first.customerName === 'string' ? first.customerName : '',
        items: group.map((line) => ({
          sku:
            (typeof line.merchantSKU === 'string' && line.merchantSKU) ||
            (typeof line.sku === 'string' && line.sku) ||
            '',
          barcode:
            (typeof line.productBarcode === 'string' && line.productBarcode) ||
            (typeof line.barcode === 'string' && line.barcode) ||
            '',
          quantity: typeof line.quantity === 'number' ? line.quantity : 0,
          unitPrice: moneyAmount(line.unitPrice),
          platformItemId:
            (typeof line.id === 'string' && line.id) || platformOrderId,
          productName: typeof line.name === 'string' ? line.name : undefined,
        })),
        totalAmount: total,
        currency,
        createdAt: dates[0] ?? new Date().toISOString(),
        cargoTrackingNumber: undefined,
        cargoProvider:
          typeof first.cargoCompany === 'string' ? first.cargoCompany : undefined,
      });
    }
    return orders;
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const { username, password } = credentials;
    const merchantId = this.resolveMerchantId(credentials);
    const client = this.getListingClient(username, password, credentials);
    const path =
      merchantId.length > 0
        ? `/listings/merchantid/${encodeURIComponent(merchantId)}/listings`
        : '/listings/merchantid/self/listings';

    const { data } = await client.get<HepsiburadaListingsResponse | Record<string, unknown>>(
      path,
      { params: { offset: page * 50, limit: 50 } },
    );

    const inner = extractListingsInner(data);
    if (!inner) {
      return { items: [], total: 0, page, pageSize: 50 };
    }

    return {
      items: inner.listings.map((l) => ({
        platformProductId: l.hepsiburadaSku,
        barcode: l.barcode,
        title: l.productName,
        quantity: l.availableStock,
        salePrice: l.price,
        listPrice: l.listPrice,
        approved: l.isSalable,
        images: l.images,
      })),
      total: inner.totalCount,
      page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const { username, password } = credentials;
    const merchantId = this.resolveMerchantId(credentials);
    if (!merchantId) {
      throw new Error('Hepsiburada merchantId veya username zorunlu');
    }
    const client = this.getListingClient(username, password, credentials);
    const path = `/listings/merchantid/${encodeURIComponent(merchantId)}/stock-uploads`;
    const batches = chunk(updates, 50);
    for (const batch of batches) {
      const body = batch.map((u) => ({
        merchantSku: u.barcode,
        availableStock: u.quantity,
      }));
      await client.post(path, body);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const { username, password } = credentials;
    const merchantId = this.resolveMerchantId(credentials);
    if (!merchantId) {
      throw new Error('Hepsiburada merchantId veya username zorunlu');
    }
    const client = this.getListingClient(username, password, credentials);
    const path = `/listings/merchantid/${encodeURIComponent(merchantId)}/price-uploads`;
    const batches = chunk(updates, 50);
    for (const batch of batches) {
      const body = batch.map((u) => ({
        merchantSku: u.barcode,
        price: u.salePrice,
      }));
      await client.post(path, body);
    }
  }
}

function extractListingsInner(
  data: HepsiburadaListingsResponse | Record<string, unknown>,
): HepsiburadaListingsResponse['data'] | null {
  if ('data' in data && data.data && typeof data.data === 'object') {
    const d = data.data as Record<string, unknown>;
    if (Array.isArray(d.listings)) {
      return data.data as HepsiburadaListingsResponse['data'];
    }
  }
  if ('listings' in data && Array.isArray((data as { listings: unknown }).listings)) {
    return data as unknown as HepsiburadaListingsResponse['data'];
  }
  return null;
}

function moneyAmount(value: unknown): number {
  if (value && typeof value === 'object' && 'amount' in value) {
    const a = (value as { amount: unknown }).amount;
    return typeof a === 'number' && Number.isFinite(a) ? a : 0;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
