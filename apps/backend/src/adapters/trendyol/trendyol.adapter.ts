import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, type AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  mapTrendyolStatus,
  toMarketplaceOrder,
  type NormalizedOrder,
} from '../common/order-normalizer';
import { RedisRateLimiter } from '../common/redis-rate-limiter';
import {
  TRENDYOL_ORDERS,
  TRENDYOL_PRICE_INVENTORY,
  TRENDYOL_PRODUCTS,
  TRENDYOL_USER_AGENT_SUFFIX,
  trendyolSupplierBaseUrl,
} from './trendyol.constants';
import type {
  TrendyolOrder,
  TrendyolOrdersResponse,
  TrendyolPriceInventoryItem,
  TrendyolProductsResponse,
} from './trendyol.types';

const BATCH_DELAY_MS = 100;

@Injectable()
export class TrendyolAdapter implements IMarketplaceAdapter {
  readonly platform: string = 'TRENDYOL';
  private readonly logger = new Logger(TrendyolAdapter.name);

  constructor(private readonly rateLimiter: RedisRateLimiter) {}

  protected trendyolBaseUrl(supplierId: string): string {
    return trendyolSupplierBaseUrl(supplierId);
  }

  protected extraTrendyolHeaders(
    credentials: Record<string, string>,
  ): Record<string, string> {
    void credentials;
    return {};
  }

  private resolveSupplierId(credentials: Record<string, string>): string {
    const id =
      (typeof credentials.supplierId === 'string' && credentials.supplierId.trim()) ||
      (typeof credentials.sellerId === 'string' && credentials.sellerId.trim()) ||
      '';
    if (!id) {
      throw new Error('Trendyol supplierId veya sellerId zorunlu');
    }
    return id;
  }

  private rateLimitKey(credentials: Record<string, string>): string {
    return this.resolveSupplierId(credentials);
  }

  private getClient(
    supplierId: string,
    apiKey: string,
    apiSecret: string,
    credentials: Record<string, string>,
  ): AxiosInstance {
    return axios.create({
      baseURL: this.trendyolBaseUrl(supplierId),
      auth: { username: apiKey, password: apiSecret },
      headers: {
        'User-Agent': `${supplierId} - ${TRENDYOL_USER_AGENT_SUFFIX}`,
        'Content-Type': 'application/json',
        ...this.extraTrendyolHeaders(credentials),
      },
      timeout: 15_000,
    });
  }

  private async request<T>(
    client: AxiosInstance,
    credentials: Record<string, string>,
    method: 'GET' | 'POST',
    path: string,
    options?: { params?: Record<string, string | number>; data?: unknown },
  ): Promise<T> {
    await this.rateLimiter.acquire(this.platform, this.rateLimitKey(credentials));
    try {
      const { data } = await client.request<T>({
        method,
        url: path,
        params: options?.params,
        data: options?.data,
      });
      return data;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  private toApiError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const ax = error as AxiosError<{ message?: string }>;
      const status = ax.response?.status;
      const body = ax.response?.data;
      const detail =
        typeof body === 'object' && body !== null && typeof body.message === 'string'
          ? body.message
          : ax.message;
      return new Error(
        `Trendyol API${status != null ? ` (${String(status)})` : ''}: ${detail}`,
      );
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error('Trendyol API isteği başarısız');
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { apiKey, apiSecret } = credentials;
      if (!apiKey || !apiSecret) {
        return false;
      }
      const supplierId = this.resolveSupplierId(credentials);
      const client = this.getClient(supplierId, apiKey, apiSecret, credentials);
      await this.request<TrendyolProductsResponse>(
        client,
        credentials,
        'GET',
        TRENDYOL_PRODUCTS,
        { params: { approved: 'true', page: 0, size: 1 } },
      );
      return true;
    } catch (error) {
      this.logger.warn('Trendyol bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedOrder[]> {
    const { apiKey, apiSecret } = credentials;
    const supplierId = this.resolveSupplierId(credentials);
    const client = this.getClient(supplierId, apiKey, apiSecret, credentials);

    const startDate = since
      ? since.getTime()
      : Date.now() - 7 * 24 * 3600 * 1000;

    const response = await this.request<TrendyolOrdersResponse>(
      client,
      credentials,
      'GET',
      TRENDYOL_ORDERS,
      {
        params: {
          status: 'Created,Picking',
          startDate,
          endDate: Date.now(),
          page: 0,
          size: 200,
        },
      },
    );

    const rows = response.content ?? response.orders ?? [];
    return rows.map((raw) => this.normalizeOrder(raw));
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const normalized = await this.fetchOrders(credentials, since);
    return normalized.map(toMarketplaceOrder);
  }

  private normalizeOrder(raw: TrendyolOrder): NormalizedOrder {
    const addr = raw.shipmentAddress;
    const first = addr?.firstName ?? '';
    const last = addr?.lastName ?? '';
    const phone =
      (typeof addr?.phone === 'string' && addr.phone) ||
      (typeof addr?.phoneNumber === 'string' && addr.phoneNumber) ||
      undefined;

    return {
      platformOrderId: String(raw.orderNumber),
      rawStatus: raw.status,
      status: mapTrendyolStatus(raw.status),
      customerName: `${first} ${last}`.trim() || '—',
      customerPhone: phone,
      totalAmount: raw.totalPrice ?? raw.grossAmount ?? 0,
      currency: raw.currencyCode ?? 'TRY',
      cargoProvider: raw.cargoProviderName,
      trackingNumber:
        raw.cargoTrackingNumber != null
          ? String(raw.cargoTrackingNumber)
          : undefined,
      items: raw.lines.map((line) => ({
        sku: line.barcode || line.merchantSku || '',
        name: line.productName,
        quantity: line.quantity,
        unitPrice: line.price,
      })),
      shippingAddress: {
        fullAddress: addr?.fullAddress ?? '',
        city: addr?.city,
        district: addr?.district,
      },
      platformCreatedAt: new Date(raw.orderDate),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const { apiKey, apiSecret } = credentials;
    const supplierId = this.resolveSupplierId(credentials);
    const client = this.getClient(supplierId, apiKey, apiSecret, credentials);

    const data = await this.request<TrendyolProductsResponse>(
      client,
      credentials,
      'GET',
      TRENDYOL_PRODUCTS,
      { params: { approved: 'true', page, size: 50 } },
    );

    const productRows = data.content ?? data.products ?? [];
    const total =
      data.totalElements ?? data.totalCount ?? productRows.length;

    return {
      items: productRows.map((p) => ({
        platformProductId: String(p.id),
        barcode: p.barcode,
        title: p.title,
        quantity: p.quantity,
        salePrice: p.salePrice,
        listPrice: p.listPrice,
        approved: p.approved,
        images: (p.images ?? []).map((i) => i.url),
      })),
      total,
      page: data.page ?? page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const items: TrendyolPriceInventoryItem[] = updates.map((u) => ({
      barcode: u.barcode,
      quantity: u.quantity,
    }));
    await this.postPriceAndInventory(credentials, items);
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const items: TrendyolPriceInventoryItem[] = updates.map((u) => ({
      barcode: u.barcode,
      salePrice: u.salePrice,
      listPrice: u.listPrice,
    }));
    await this.postPriceAndInventory(credentials, items);
  }

  private async postPriceAndInventory(
    credentials: Record<string, string>,
    items: TrendyolPriceInventoryItem[],
  ): Promise<void> {
    const { apiKey, apiSecret } = credentials;
    const supplierId = this.resolveSupplierId(credentials);
    const client = this.getClient(supplierId, apiKey, apiSecret, credentials);
    const batches = chunkArray(items, 100);

    for (let i = 0; i < batches.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
      const batch = batches[i]!;
      await this.request<unknown>(
        client,
        credentials,
        'POST',
        TRENDYOL_PRICE_INVENTORY,
        { data: { items: batch } },
      );
    }
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, (i + 1) * size),
  );
}
