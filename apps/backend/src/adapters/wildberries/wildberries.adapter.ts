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
import {
  WILDBERRIES_PRICES_BASE,
  WILDBERRIES_SUPPLIERS_BASE,
} from './wildberries.constants';
import type { WildberriesOrdersResponse } from './wildberries.types';

@Injectable()
export class WildberriesAdapter implements IMarketplaceAdapter {
  readonly platform = 'WILDBERRIES';
  private readonly logger = new Logger(WildberriesAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.WILDBERRIES ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private auth(apiKey: string): { headers: Record<string, string> } {
    return { headers: { Authorization: apiKey } };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        return false;
      }
      const dateFrom = new Date(Date.now() - 86400000).toISOString();
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${WILDBERRIES_SUPPLIERS_BASE}/api/v3/orders`,
          timeout: 12_000,
          params: { dateFrom: dateFrom.slice(0, 19) },
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
      const dateFrom = (since ?? new Date(Date.now() - 7 * 86400000)).toISOString();
      return await withRateLimit('WILDBERRIES', this.rpm(), async () => {
        const data = await axiosWithRetry<WildberriesOrdersResponse>(
          {
            method: 'GET',
            url: `${WILDBERRIES_SUPPLIERS_BASE}/api/v3/orders`,
            timeout: 25_000,
            params: { dateFrom: dateFrom.slice(0, 19) },
            ...this.auth(apiKey),
          },
          {},
        );
        const orders = Array.isArray(data.orders) ? data.orders : [];
        return orders.map((o) => {
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
        });
      });
    } catch (error) {
      throwSyncFailed('WILDBERRIES', 'getOrders', error);
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
            url: `${WILDBERRIES_SUPPLIERS_BASE}/api/v3/stocks/${encodeURIComponent(warehouseId)}`,
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
      const currencyIdRaw = credentials.currencyId?.trim();
      const currencyId =
        currencyIdRaw && !Number.isNaN(parseInt(currencyIdRaw, 10))
          ? parseInt(currencyIdRaw, 10)
          : 643;
      await withRateLimit('WILDBERRIES', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${WILDBERRIES_PRICES_BASE}/api/v2/upload/task`,
            timeout: 30_000,
            data: {
              data: updates.map((u) => {
                const nmId = parseInt(u.barcode, 10);
                return {
                  nmID: Number.isFinite(nmId) ? nmId : 0,
                  price: u.salePrice,
                  currencyID: currencyId,
                };
              }),
            },
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
