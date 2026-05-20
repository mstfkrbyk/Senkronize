import { Injectable, Logger } from '@nestjs/common';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';
import {
  isRecord,
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import type { WishOrder, WishOrderLine, WishProduct } from './wish.types';

const WISH_API_BASE = 'https://merchant.wish.com/api/v3';

@Injectable()
export class WishAdapter implements IMarketplaceAdapter {
  readonly platform = 'WISH';
  private readonly logger = new Logger(WishAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.WISH ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private requireApiKey(credentials: Record<string, string>): string {
    const apiKey = credentials.apiKey?.trim() ?? credentials.accessToken?.trim();
    if (!apiKey) {
      throw new Error('Wish: apiKey (access_token) zorunludur');
    }
    return apiKey;
  }

  private mapOrder(row: WishOrder): MarketplaceOrder | null {
    const idRaw = row.id ?? row.order_id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const createdRaw = row.order_time ?? row.updated_at;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const lines = row.product_items ?? row.items ?? [];
    return {
      platformOrderId: String(idRaw),
      status:
        typeof row.state === 'string'
          ? row.state
          : typeof row.status === 'string'
            ? row.status
            : 'NEW',
      customerName: '—',
      items: lines.map((l: WishOrderLine, i) => {
        const sku =
          typeof l.sku === 'string'
            ? l.sku
            : typeof l.product_id === 'string'
              ? l.product_id
              : `line-${String(i)}`;
        return {
          sku,
          barcode: sku,
          quantity:
            typeof l.quantity === 'number' && Number.isFinite(l.quantity)
              ? Math.max(0, Math.round(l.quantity))
              : 1,
          unitPrice: parseMoney(l.price),
          platformItemId: sku,
          productName: typeof l.name === 'string' ? l.name : undefined,
        };
      }),
      totalAmount: parseMoney(row.total ?? row.order_total),
      currency:
        typeof row.currency_code === 'string' ? row.currency_code : 'USD',
      createdAt,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiKey = this.requireApiKey(credentials);
      const since = Math.floor((Date.now() - 86400000) / 1000);
      await withRateLimit('WISH', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${WISH_API_BASE}/orders`,
            timeout: 12_000,
            params: { access_token: apiKey, since, limit: 1, start: 0 },
          },
          { maxRetries: 1 },
        );
      });
      return true;
    } catch (error) {
      this.logger.warn('Wish bağlantı testi başarısız', {
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
      const apiKey = this.requireApiKey(credentials);
      const sinceTs = Math.floor(
        (since ?? new Date(Date.now() - 30 * 86400000)).getTime() / 1000,
      );
      const orders: MarketplaceOrder[] = [];
      let start = 0;
      const limit = 50;
      for (;;) {
        const data = await withRateLimit('WISH', this.rpm(), async () =>
          axiosWithRetry<unknown>(
            {
              method: 'GET',
              url: `${WISH_API_BASE}/orders`,
              timeout: 25_000,
              params: {
                access_token: apiKey,
                since: sinceTs,
                limit,
                start,
              },
            },
            {},
          ),
        );
        const rows = normalizeOrdersRows(data) as WishOrder[];
        if (rows.length === 0) {
          break;
        }
        for (const row of rows) {
          const mapped = this.mapOrder(row);
          if (mapped) {
            orders.push(mapped);
          }
        }
        if (rows.length < limit) {
          break;
        }
        start += limit;
      }
      return orders;
    } catch (error) {
      throwSyncFailed(this.platform, 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const apiKey = this.requireApiKey(credentials);
      const limit = 50;
      const data = await withRateLimit('WISH', this.rpm(), async () =>
        axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${WISH_API_BASE}/products`,
            timeout: 25_000,
            params: { access_token: apiKey, limit, start: page * limit },
          },
          {},
        ),
      );
      const { rows, total } = normalizeProductRows(data);
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? (row as WishProduct) : {};
        const sku =
          typeof p.sku === 'string'
            ? p.sku
            : p.id !== undefined && p.id !== null
              ? String(p.id)
              : `row-${i}`;
        const title = typeof p.name === 'string' ? p.name : sku;
        const sale = parseMoney(p.price);
        const qty =
          typeof p.inventory === 'number' && Number.isFinite(p.inventory)
            ? Math.max(0, Math.round(p.inventory))
            : 0;
        return {
          platformProductId: sku,
          barcode: sku,
          title,
          quantity: qty,
          salePrice: sale,
          listPrice: sale,
          approved: p.enabled !== false,
          images: [],
        };
      });
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize: limit,
      };
    } catch (error) {
      throwSyncFailed(this.platform, 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = this.requireApiKey(credentials);
      await withRateLimit('WISH', this.rpm(), async () => {
        for (const u of updates) {
          await axiosWithRetry<unknown>(
            {
              method: 'POST',
              url: `${WISH_API_BASE}/inventory/update`,
              timeout: 25_000,
              data: {
                access_token: apiKey,
                sku: u.barcode,
                quantity: u.quantity,
              },
            },
            {},
          );
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = this.requireApiKey(credentials);
      await withRateLimit('WISH', this.rpm(), async () => {
        for (const u of updates) {
          const price = u.salePrice > 0 ? u.salePrice : u.listPrice;
          await axiosWithRetry<unknown>(
            {
              method: 'POST',
              url: `${WISH_API_BASE}/inventory/update`,
              timeout: 25_000,
              data: {
                access_token: apiKey,
                sku: u.barcode,
                price,
              },
            },
            {},
          );
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }

  /** Kargo bildirimi — POST /order/update-tracking */
  async shipOrder(
    credentials: Record<string, string>,
    orderId: string,
    trackingNumber: string,
    shippingProvider: string,
  ): Promise<void> {
    try {
      const apiKey = this.requireApiKey(credentials);
      await withRateLimit('WISH', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${WISH_API_BASE}/order/update-tracking`,
            timeout: 25_000,
            data: {
              access_token: apiKey,
              id: orderId,
              tracking_number: trackingNumber,
              shipping_provider: shippingProvider,
            },
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'shipOrder', error);
    }
  }
}
