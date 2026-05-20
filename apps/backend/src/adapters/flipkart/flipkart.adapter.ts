import { Buffer } from 'node:buffer';

import { Injectable, Logger } from '@nestjs/common';
import type { AxiosRequestConfig } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';
import { parseMoney, throwSyncFailed } from '../stub-helpers';
import {
  FLIPKART_API_BASE,
  FLIPKART_DEFAULT_CURRENCY,
  FLIPKART_DEFAULT_LOCATION_ID,
  FLIPKART_ORDER_STATE,
  FLIPKART_PAGE_SIZE,
} from './flipkart.constants';
import type {
  FlipkartListingRow,
  FlipkartListingsResponse,
  FlipkartOrderItem,
  FlipkartOrderSummary,
  FlipkartOrdersFilterResponse,
  FlipkartShipmentPayload,
} from './flipkart.types';

@Injectable()
export class FlipkartAdapter implements IMarketplaceAdapter {
  readonly platform = 'FLIPKART';
  private readonly logger = new Logger(FlipkartAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.FLIPKART ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private resolveApiCredentials(credentials: Record<string, string>): {
    apiKey: string;
    secretKey: string;
  } {
    const apiKey =
      credentials.apiKey?.trim() ||
      credentials.clientId?.trim() ||
      '';
    const secretKey =
      credentials.secretKey?.trim() ||
      credentials.clientSecret?.trim() ||
      credentials.apiSecret?.trim() ||
      '';
    if (!apiKey || !secretKey) {
      throw new Error(
        'Flipkart: apiKey ve secretKey (Basic Auth) zorunludur',
      );
    }
    return { apiKey, secretKey };
  }

  private auth(credentials: Record<string, string>): Pick<AxiosRequestConfig, 'headers'> {
    const { apiKey, secretKey } = this.resolveApiCredentials(credentials);
    const basic = Buffer.from(`${apiKey}:${secretKey}`, 'utf8').toString('base64');
    return {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
    };
  }

  private locationId(credentials: Record<string, string>): string {
    const loc = credentials.locationId?.trim();
    return loc && loc.length > 0 ? loc : FLIPKART_DEFAULT_LOCATION_ID;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await withRateLimit('FLIPKART', this.rpm(), async () => {
        await axiosWithRetry<FlipkartOrdersFilterResponse>(
          {
            method: 'GET',
            url: `${FLIPKART_API_BASE}/orders/filter`,
            timeout: 12_000,
            params: {
              orderState: FLIPKART_ORDER_STATE,
              pageSize: 1,
              pageNumber: 1,
            },
            ...this.auth(credentials),
          },
          { maxRetries: 1 },
        );
      });
      return true;
    } catch (error) {
      this.logger.warn('Flipkart bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private collectOrderItems(order: FlipkartOrderSummary): FlipkartOrderItem[] {
    const direct = Array.isArray(order.orderItems) ? order.orderItems : [];
    if (direct.length > 0) {
      return direct;
    }
    const fromSub: FlipkartOrderItem[] = [];
    const subs = Array.isArray(order.subOrders) ? order.subOrders : [];
    for (const sub of subs) {
      const items = Array.isArray(sub.orderItems) ? sub.orderItems : [];
      fromSub.push(...items);
    }
    return fromSub;
  }

  private mapOrder(row: FlipkartOrderSummary): MarketplaceOrder | null {
    const idRaw = row.orderId;
    if (typeof idRaw !== 'string' || idRaw.length === 0) {
      return null;
    }
    const lines = this.collectOrderItems(row);
    const createdRaw = row.orderDate;
    const customerName =
      typeof row.buyerName === 'string' && row.buyerName.length > 0
        ? row.buyerName
        : typeof row.customerName === 'string' && row.customerName.length > 0
          ? row.customerName
          : '—';
    const total =
      typeof row.totalAmount === 'number'
        ? row.totalAmount
        : typeof row.orderAmount === 'number'
          ? row.orderAmount
          : 0;
    return {
      platformOrderId: idRaw,
      status: typeof row.orderState === 'string' ? row.orderState : 'APPROVED',
      customerName,
      items: lines.map((l) => {
        const sku =
          typeof l.fsn === 'string'
            ? l.fsn
            : typeof l.sku === 'string'
              ? l.sku
              : '';
        const qty =
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0;
        const unitPrice = parseMoney(l.sellingPrice ?? l.price);
        return {
          sku,
          barcode: sku,
          quantity: qty,
          unitPrice,
          platformItemId:
            typeof l.orderItemId === 'string' ? l.orderItemId : sku,
          productName: typeof l.title === 'string' ? l.title : undefined,
        };
      }),
      totalAmount: total,
      currency: FLIPKART_DEFAULT_CURRENCY,
      createdAt:
        typeof createdRaw === 'string' && createdRaw.length > 0
          ? new Date(createdRaw).toISOString()
          : new Date().toISOString(),
    };
  }

  async getOrderDetail(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<FlipkartOrderSummary | null> {
    try {
      return await withRateLimit('FLIPKART', this.rpm(), async () => {
        return await axiosWithRetry<FlipkartOrderSummary>(
          {
            method: 'GET',
            url: `${FLIPKART_API_BASE}/orders/${encodeURIComponent(orderId)}`,
            timeout: 20_000,
            ...this.auth(credentials),
          },
          { maxRetries: 1 },
        );
      });
    } catch (error) {
      this.logger.warn('Flipkart sipariş detayı alınamadı', {
        orderId,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return null;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const all: MarketplaceOrder[] = [];
      let pageNumber = 1;
      let hasMore = true;

      await withRateLimit('FLIPKART', this.rpm(), async () => {
        while (hasMore) {
          const data = await axiosWithRetry<FlipkartOrdersFilterResponse>(
            {
              method: 'GET',
              url: `${FLIPKART_API_BASE}/orders/filter`,
              timeout: 25_000,
              params: {
                orderState: FLIPKART_ORDER_STATE,
                pageSize: FLIPKART_PAGE_SIZE,
                pageNumber,
              },
              ...this.auth(credentials),
            },
            {},
          );
          const rows = Array.isArray(data.orderList)
            ? data.orderList
            : Array.isArray(data.orders)
              ? data.orders
              : [];
          for (const row of rows) {
            if (since !== undefined) {
              const createdRaw = row.orderDate;
              if (typeof createdRaw === 'string' && createdRaw.length > 0) {
                const created = new Date(createdRaw);
                if (Number.isFinite(created.getTime()) && created < since) {
                  continue;
                }
              }
            }
            const mapped = this.mapOrder(row);
            if (mapped) {
              all.push(mapped);
            }
          }
          hasMore =
            data.hasMore === true ||
            (rows.length >= FLIPKART_PAGE_SIZE &&
              typeof data.nextPageNumber === 'number');
          if (rows.length < FLIPKART_PAGE_SIZE) {
            hasMore = false;
          } else {
            pageNumber =
              typeof data.nextPageNumber === 'number'
                ? data.nextPageNumber
                : pageNumber + 1;
          }
        }
      });
      return all;
    } catch (error) {
      throwSyncFailed('FLIPKART', 'getOrders', error);
    }
  }

  private mapListing(row: FlipkartListingRow): MarketplaceListing | null {
    const fsn =
      typeof row.fsn === 'string'
        ? row.fsn
        : typeof row.sku === 'string'
          ? row.sku
          : '';
    if (fsn.length === 0) {
      return null;
    }
    const qty =
      typeof row.inventory?.quantity === 'number' &&
      Number.isFinite(row.inventory.quantity)
        ? Math.max(0, Math.round(row.inventory.quantity))
        : 0;
    const sale = parseMoney(
      row.price?.selling_price ?? row.price?.sellingPrice,
    );
    const list = parseMoney(row.price?.mrp ?? sale);
    const title =
      typeof row.productTitle === 'string'
        ? row.productTitle
        : typeof row.title === 'string'
          ? row.title
          : fsn;
    return {
      platformProductId: fsn,
      barcode: fsn,
      title,
      quantity: qty,
      salePrice: sale,
      listPrice: list,
      approved: row.listingStatus === 'ACTIVE' || row.listingStatus === undefined,
      images: [],
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const skuListRaw = credentials.listingSkus?.trim();
      if (!skuListRaw) {
        return {
          items: [],
          total: 0,
          page,
          pageSize: FLIPKART_PAGE_SIZE,
        };
      }
      const skus = skuListRaw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const pageSkus = skus.slice(
        page * FLIPKART_PAGE_SIZE,
        (page + 1) * FLIPKART_PAGE_SIZE,
      );
      const items: MarketplaceListing[] = [];

      await withRateLimit('FLIPKART', this.rpm(), async () => {
        for (const fsn of pageSkus) {
          const data = await axiosWithRetry<FlipkartListingsResponse>(
            {
              method: 'GET',
              url: `${FLIPKART_API_BASE}/listings`,
              timeout: 20_000,
              params: { fsn, listingStatus: 'ACTIVE' },
              ...this.auth(credentials),
            },
            { maxRetries: 1 },
          );
          const rows = Array.isArray(data.listings)
            ? data.listings
            : Array.isArray(data.available)
              ? data.available
              : [];
          for (const row of rows) {
            const mapped = this.mapListing(row);
            if (mapped) {
              items.push(mapped);
            }
          }
        }
      });

      return {
        items,
        total: skus.length,
        page,
        pageSize: FLIPKART_PAGE_SIZE,
      };
    } catch (error) {
      throwSyncFailed('FLIPKART', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const loc = this.locationId(credentials);
      const currency =
        credentials.currency?.trim().toUpperCase() || FLIPKART_DEFAULT_CURRENCY;
      await withRateLimit('FLIPKART', this.rpm(), async () => {
        const listings = updates.map((u) => ({
          fsn: u.barcode.trim(),
          locationId: loc,
          inventory: { quantity: Math.max(0, Math.round(u.quantity)) },
          price: {
            currency,
            mrp: 0,
            selling_price: 0,
          },
        }));
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url: `${FLIPKART_API_BASE}/listings`,
            timeout: 25_000,
            data: { listings },
            ...this.auth(credentials),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('FLIPKART', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const loc = this.locationId(credentials);
      const currency =
        credentials.currency?.trim().toUpperCase() || FLIPKART_DEFAULT_CURRENCY;
      await withRateLimit('FLIPKART', this.rpm(), async () => {
        const listings = updates.map((u) => ({
          fsn: u.barcode.trim(),
          locationId: loc,
          inventory: { quantity: 0 },
          price: {
            currency,
            mrp: u.listPrice > 0 ? u.listPrice : u.salePrice,
            selling_price: u.salePrice,
          },
        }));
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url: `${FLIPKART_API_BASE}/listings`,
            timeout: 25_000,
            data: { listings },
            ...this.auth(credentials),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('FLIPKART', 'updatePrice', error);
    }
  }

  async createShipment(
    credentials: Record<string, string>,
    payload: FlipkartShipmentPayload,
  ): Promise<void> {
    try {
      await withRateLimit('FLIPKART', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${FLIPKART_API_BASE}/orders/${encodeURIComponent(payload.orderId)}/shipments`,
            timeout: 25_000,
            data: {
              subOrderIds: payload.subOrderIds,
              trackingId: payload.trackingId,
              serviceName: payload.serviceName?.trim() || 'FEDEX',
            },
            ...this.auth(credentials),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('FLIPKART', 'createShipment', error);
    }
  }
}
