import { Injectable, Logger } from '@nestjs/common';
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
import { throwSyncFailed } from '../stub-helpers';
import { WILDBERRIES_SUPPLIERS_BASE } from './wildberries.constants';
import type { WildberriesOrder, WildberriesOrdersResponse } from './wildberries.types';

const WILDBERRIES_API_V3 = `${WILDBERRIES_SUPPLIERS_BASE}/api/v3`;

@Injectable()
export class WildberriesAdapter implements IMarketplaceAdapter {
  readonly platform = 'WILDBERRIES';
  private readonly logger = new Logger(WildberriesAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.WILDBERRIES ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private auth(apiKey: string): { headers: Record<string, string> } {
    const token = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    return {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
    };
  }

  private resolveDateFromTimestamp(since?: Date): number {
    const date = since ?? new Date(Date.now() - 7 * 86400000);
    return Math.floor(date.getTime() / 1000);
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        return false;
      }
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${WILDBERRIES_API_V3}/orders`,
          timeout: 12_000,
          params: {
            limit: 1,
            dateFrom: this.resolveDateFromTimestamp(),
          },
          ...this.auth(apiKey),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Wildberries bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Wildberries: apiKey zorunludur');
      }
      const dateFrom = this.resolveDateFromTimestamp(since);
      const all: MarketplaceOrder[] = [];
      let next = 0;
      let hasMore = true;

      while (hasMore) {
        const page = await withRateLimit('WILDBERRIES', this.rpm(), async () =>
          axiosWithRetry<WildberriesOrdersResponse>(
            {
              method: 'GET',
              url: `${WILDBERRIES_API_V3}/orders`,
              timeout: 25_000,
              params: {
                limit: 100,
                next,
                dateFrom,
              },
              ...this.auth(apiKey),
            },
            {},
          ),
        );

        const orders = Array.isArray(page.orders) ? page.orders : [];
        all.push(...orders.map((o) => this.mapOrder(o)));

        const nextCursor =
          typeof page.next === 'number' && Number.isFinite(page.next)
            ? page.next
            : 0;
        hasMore = orders.length >= 100 && nextCursor > next;
        next = nextCursor;
      }

      return all;
    } catch (error) {
      throwSyncFailed('WILDBERRIES', 'getOrders', error);
    }
  }

  private mapOrder(o: WildberriesOrder): MarketplaceOrder {
    const oid =
      typeof o.orderId === 'string' && o.orderId.length > 0
        ? o.orderId
        : String(o.id ?? '');
    const created =
      typeof o.createdAt === 'string' && o.createdAt.length > 0
        ? new Date(o.createdAt).toISOString()
        : new Date().toISOString();
    const sku =
      typeof o.article === 'string'
        ? o.article
        : Array.isArray(o.skus) && typeof o.skus[0] === 'string'
          ? o.skus[0]
          : oid;
    const amount =
      typeof o.convertedPrice === 'number' && Number.isFinite(o.convertedPrice)
        ? o.convertedPrice
        : 0;
    return {
      platformOrderId: oid,
      status:
        typeof o.supplierStatus === 'string' ? o.supplierStatus : 'NEW',
      customerName: '—',
      items: [
        {
          sku,
          barcode: sku,
          quantity: 1,
          unitPrice: amount,
          platformItemId: String(o.id ?? sku),
          productName: undefined,
        },
      ],
      totalAmount: amount,
      currency: typeof o.currencyCode === 'string' ? o.currencyCode : 'RUB',
      createdAt: created,
    };
  }

  async reportShipping(
    credentials: Record<string, string>,
    orderId: string,
    trackingNumber?: string,
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Wildberries: apiKey zorunludur');
      }
      await withRateLimit('WILDBERRIES', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url: `${WILDBERRIES_API_V3}/orders/${encodeURIComponent(orderId)}`,
            timeout: 25_000,
            data: trackingNumber?.trim()
              ? { trackingNumber: trackingNumber.trim() }
              : {},
            ...this.auth(apiKey),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('WILDBERRIES', 'reportShipping', error);
    }
  }

  async getListings(
    _credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    void _credentials;
    this.logger.debug('Wildberries getListings: içerik API entegrasyonu henüz yok, boş dönülüyor');
    return { items: [], total: 0, page, pageSize: 50 };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const warehouseId = credentials.warehouseId?.trim();
      if (!apiKey || !warehouseId) {
        throw new Error('Wildberries: apiKey ve warehouseId zorunludur');
      }
      await withRateLimit('WILDBERRIES', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url: `${WILDBERRIES_API_V3}/warehouses/${encodeURIComponent(warehouseId)}/stocks`,
            timeout: 25_000,
            data: {
              stocks: updates.map((u) => ({
                sku: u.barcode,
                amount: u.quantity,
              })),
            },
            ...this.auth(apiKey),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('WILDBERRIES', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Wildberries: apiKey zorunludur');
      }
      await withRateLimit('WILDBERRIES', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${WILDBERRIES_API_V3}/card/update`,
            timeout: 30_000,
            data: updates.map((u) => {
              const nmId = parseInt(u.barcode, 10);
              return {
                nmID: Number.isFinite(nmId) ? nmId : 0,
                price: Math.round(u.salePrice),
              };
            }),
            ...this.auth(apiKey),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('WILDBERRIES', 'updatePrice', error);
    }
  }
}
