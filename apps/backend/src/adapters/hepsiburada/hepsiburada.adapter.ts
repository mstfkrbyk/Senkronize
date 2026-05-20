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
  mapHepsiburadaStatus,
  toMarketplaceOrder,
  type NormalizedOrder,
} from '../common/order-normalizer';
import { RedisRateLimiter } from '../common/redis-rate-limiter';
import {
  HEPSIBURADA_INTEGRATION_ID,
  HEPSIBURADA_LISTING_BASE_URL,
  HEPSIBURADA_OMS_BASE_URL,
} from './hepsiburada.constants';
import type {
  HepsiburadaInventoryUploadItem,
  HepsiburadaListingsResponse,
  HepsiburadaOrderListItem,
  HepsiburadaOrderListResponse,
  HepsiburadaPackageDetail,
} from './hepsiburada.types';

@Injectable()
export class HepsiburadaAdapter implements IMarketplaceAdapter {
  readonly platform: string = 'HEPSIBURADA';
  private readonly logger = new Logger(HepsiburadaAdapter.name);

  constructor(private readonly rateLimiter: RedisRateLimiter) {}

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

  private rateLimitKey(credentials: Record<string, string>): string {
    return this.resolveMerchantId(credentials) || 'default';
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

  private async omsRequest<T>(
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
      throw this.toApiError('Hepsiburada OMS', error);
    }
  }

  private async listingRequest<T>(
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
      throw this.toApiError('Hepsiburada Listing', error);
    }
  }

  private toApiError(label: string, error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const ax = error as AxiosError<{ message?: string }>;
      const status = ax.response?.status;
      const detail =
        typeof ax.response?.data === 'object' &&
        ax.response.data !== null &&
        typeof ax.response.data.message === 'string'
          ? ax.response.data.message
          : ax.message;
      return new Error(
        `${label} API${status != null ? ` (${String(status)})` : ''}: ${detail}`,
      );
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(`${label} API isteği başarısız`);
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
      await this.listingRequest(client, credentials, 'GET', path, {
        params: { offset: 0, limit: 1 },
      });
      return true;
    } catch (error) {
      this.logger.warn('Hepsiburada bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedOrder[]> {
    const { username, password } = credentials;
    const merchantId = this.resolveMerchantId(credentials);
    if (!merchantId) {
      throw new Error('Hepsiburada merchantId veya username zorunlu');
    }
    const client = this.getOmsClient(username, password, credentials);
    const end = new Date();
    const start = since ?? new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const beginDate = formatHbDate(start);
    const endDate = formatHbDate(end);

    const all: NormalizedOrder[] = [];
    let page = 0;
    const size = 50;
    let hasMore = true;

    while (hasMore) {
      const data = await this.omsRequest<HepsiburadaOrderListResponse>(
        client,
        credentials,
        'GET',
        `/orders/merchantid/${encodeURIComponent(merchantId)}/orderlist`,
        {
          params: {
            beginDate,
            endDate,
            status: 'WaitingForPacking',
            page,
            size,
          },
        },
      );

      const rows = data.orders ?? data.content ?? [];
      for (const row of rows) {
        all.push(this.normalizeOrderListItem(row));
      }

      hasMore = rows.length >= size;
      page += 1;
    }

    return all;
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const normalized = await this.fetchOrders(credentials, since);
    return normalized.map(toMarketplaceOrder);
  }

  private normalizeOrderListItem(raw: HepsiburadaOrderListItem): NormalizedOrder {
    const lines = raw.lines ?? raw.items ?? [];
    const platformOrderId =
      (typeof raw.orderNumber === 'string' && raw.orderNumber) ||
      (typeof raw.orderId === 'string' && raw.orderId) ||
      (typeof raw.packageId === 'string' && raw.packageId) ||
      'unknown';

    const rawStatus =
      typeof raw.status === 'string' ? raw.status : 'WaitingForPacking';
    return {
      platformOrderId,
      rawStatus,
      status: mapHepsiburadaStatus(rawStatus),
      customerName:
        typeof raw.customerName === 'string' ? raw.customerName : '—',
      customerPhone:
        typeof raw.customerPhone === 'string' ? raw.customerPhone : undefined,
      totalAmount:
        typeof raw.totalAmount === 'number' && Number.isFinite(raw.totalAmount)
          ? raw.totalAmount
          : 0,
      currency: raw.currency ?? 'TRY',
      cargoProvider: raw.cargoCompanyName,
      trackingNumber: raw.trackingNumber,
      items: lines.map((line) => ({
        sku:
          line.hepsiburadaSku ??
          line.merchantSku ??
          line.sku ??
          line.barcode ??
          '',
        name: line.productName ?? line.name ?? '',
        quantity:
          typeof line.quantity === 'number' && Number.isFinite(line.quantity)
            ? line.quantity
            : 0,
        unitPrice:
          typeof line.unitPrice === 'number'
            ? line.unitPrice
            : typeof line.price === 'number'
              ? line.price
              : 0,
      })),
      shippingAddress: { fullAddress: '' },
      platformCreatedAt: raw.orderDate
        ? new Date(raw.orderDate)
        : new Date(),
    };
  }

  async getPackageDetail(
    credentials: Record<string, string>,
    packageId: string,
  ): Promise<NormalizedOrder> {
    const { username, password } = credentials;
    const merchantId = this.resolveMerchantId(credentials);
    if (!merchantId) {
      throw new Error('Hepsiburada merchantId veya username zorunlu');
    }
    const client = this.getOmsClient(username, password, credentials);
    const data = await this.omsRequest<HepsiburadaPackageDetail>(
      client,
      credentials,
      'GET',
      `/packages/merchantid/${encodeURIComponent(merchantId)}/packagelist/${encodeURIComponent(packageId)}`,
    );
    return this.normalizePackageDetail(data, packageId);
  }

  private normalizePackageDetail(
    raw: HepsiburadaPackageDetail,
    packageId: string,
  ): NormalizedOrder {
    const lines = raw.lines ?? raw.items ?? [];
    const rawStatus =
      typeof raw.status === 'string' ? raw.status : 'WaitingForPacking';
    return {
      platformOrderId:
        (typeof raw.orderNumber === 'string' && raw.orderNumber) || packageId,
      rawStatus,
      status: mapHepsiburadaStatus(rawStatus),
      customerName:
        typeof raw.customerName === 'string' ? raw.customerName : '—',
      customerPhone:
        typeof raw.customerPhone === 'string' ? raw.customerPhone : undefined,
      totalAmount:
        typeof raw.totalAmount === 'number' && Number.isFinite(raw.totalAmount)
          ? raw.totalAmount
          : 0,
      currency: raw.currency ?? 'TRY',
      cargoProvider: raw.cargoCompanyName,
      trackingNumber: raw.trackingNumber,
      items: lines.map((line) => ({
        sku:
          line.hepsiburadaSku ??
          line.merchantSku ??
          line.sku ??
          line.barcode ??
          '',
        name: line.productName ?? line.name ?? '',
        quantity:
          typeof line.quantity === 'number' && Number.isFinite(line.quantity)
            ? line.quantity
            : 0,
        unitPrice:
          typeof line.unitPrice === 'number'
            ? line.unitPrice
            : typeof line.price === 'number'
              ? line.price
              : 0,
      })),
      shippingAddress: { fullAddress: '' },
      platformCreatedAt: raw.orderDate
        ? new Date(raw.orderDate)
        : new Date(),
    };
  }

  async reportShipping(
    credentials: Record<string, string>,
    packageId: string,
    cargoCompanyName: string,
    trackingNumber: string,
  ): Promise<void> {
    const { username, password } = credentials;
    const merchantId = this.resolveMerchantId(credentials);
    if (!merchantId) {
      throw new Error('Hepsiburada merchantId veya username zorunlu');
    }
    const client = this.getOmsClient(username, password, credentials);
    await this.omsRequest(
      client,
      credentials,
      'POST',
      `/packages/merchantid/${encodeURIComponent(merchantId)}/packagelist/${encodeURIComponent(packageId)}/shippinginfo`,
      {
        data: {
          cargoCompanyName,
          trackingNumber,
          isCancelled: false,
        },
      },
    );
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

    const data = await this.listingRequest<
      HepsiburadaListingsResponse | Record<string, unknown>
    >(client, credentials, 'GET', path, {
      params: { offset: page * 50, limit: 50 },
    });

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
    const listings: HepsiburadaInventoryUploadItem[] = updates.map((u) => ({
      hepsiburadaSku: u.barcode,
      availableStock: u.quantity,
    }));
    await this.postInventoryUpload(credentials, listings);
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const listings: HepsiburadaInventoryUploadItem[] = updates.map((u) => ({
      hepsiburadaSku: u.barcode,
      price: u.salePrice,
      listingPrice: u.listPrice,
    }));
    await this.postInventoryUpload(credentials, listings);
  }

  private async postInventoryUpload(
    credentials: Record<string, string>,
    listings: HepsiburadaInventoryUploadItem[],
  ): Promise<void> {
    const { username, password } = credentials;
    const merchantId = this.resolveMerchantId(credentials);
    if (!merchantId) {
      throw new Error('Hepsiburada merchantId veya username zorunlu');
    }
    const client = this.getListingClient(username, password, credentials);
    const path = `/listings/merchantid/${encodeURIComponent(merchantId)}/inventory-uploads`;
    const batches = chunk(listings, 50);
    for (const batch of batches) {
      await this.listingRequest(client, credentials, 'POST', path, {
        data: { listings: batch },
      });
    }
  }
}

function formatHbDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${day}`;
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

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
