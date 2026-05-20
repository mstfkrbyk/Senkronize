import { Buffer } from 'node:buffer';

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
import { isRecord, normalizeOrdersRows, parseMoney, throwSyncFailed } from '../stub-helpers';
import { NOON_API_BASE } from './noon.constants';
import type { NoonOrderRow, NoonOrdersEnvelope } from './noon.types';

@Injectable()
export class NoonAdapter implements IMarketplaceAdapter {
  readonly platform = 'NOON';
  private readonly logger = new Logger(NoonAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.NOON ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private authHeader(
    apiKey: string,
    apiSecret: string,
  ): { headers: Record<string, string> } {
    const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    return {
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const apiSecret = credentials.apiSecret?.trim();
      if (!apiKey || !apiSecret) {
        return false;
      }
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${NOON_API_BASE}/order/export`,
          timeout: 12_000,
          params: {
            status: 'CREATED',
            start_date: start,
            end_date: end,
            limit: 1,
            page: 1,
          },
          ...this.authHeader(apiKey, apiSecret),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Noon bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private extractOrderRows(data: unknown): NoonOrderRow[] {
    if (!isRecord(data)) {
      return [];
    }
    const env = data as NoonOrdersEnvelope;
    if (Array.isArray(env.data)) {
      return env.data;
    }
    if (Array.isArray(env.orders)) {
      return env.orders;
    }
    if (Array.isArray(env.results)) {
      return env.results;
    }
    return normalizeOrdersRows(data) as NoonOrderRow[];
  }

  private mapOrder(row: NoonOrderRow): MarketplaceOrder | null {
    const idRaw = row.order_nr ?? row.order_number ?? row.id;
    if (typeof idRaw !== 'string' || idRaw.length === 0) {
      return null;
    }
    const createdRaw = row.created_at;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const lines = Array.isArray(row.items) ? row.items : [];
    const currency = typeof row.currency_code === 'string' ? row.currency_code : 'AED';
    let total = parseMoney(row.total);
    if (total <= 0 && lines.length > 0) {
      total = lines.reduce(
        (acc, l) =>
          acc +
          parseMoney(l.unit_price) *
            (typeof l.quantity === 'number' && Number.isFinite(l.quantity)
              ? Math.max(1, l.quantity)
              : 1),
        0,
      );
    }
    return {
      platformOrderId: idRaw,
      status: typeof row.status === 'string' ? row.status : 'CREATED',
      customerName: '—',
      items: lines.map((l, i) => {
        const sku =
          typeof l.partner_sku === 'string'
            ? l.partner_sku
            : typeof l.sku === 'string'
              ? l.sku
              : `line-${String(i)}`;
        return {
          sku,
          barcode: sku,
          quantity:
            typeof l.quantity === 'number' && Number.isFinite(l.quantity)
              ? Math.max(0, Math.round(l.quantity))
              : 1,
          unitPrice: parseMoney(l.unit_price),
          platformItemId: sku,
          productName: typeof l.title === 'string' ? l.title : undefined,
        };
      }),
      totalAmount: total,
      currency,
      createdAt,
    };
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const apiSecret = credentials.apiSecret?.trim();
      if (!apiKey || !apiSecret) {
        throw new Error('Noon: apiKey ve apiSecret zorunludur');
      }
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate =
        since !== undefined
          ? since.toISOString().slice(0, 10)
          : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const orders: MarketplaceOrder[] = [];
      let page = 1;
      const limit = 50;
      for (;;) {
        const data = await withRateLimit('NOON', this.rpm(), async () =>
          axiosWithRetry<unknown>(
            {
              method: 'GET',
              url: `${NOON_API_BASE}/order/export`,
              timeout: 25_000,
              params: {
                status: 'CREATED',
                start_date: startDate,
                end_date: endDate,
                limit,
                page,
              },
              ...this.authHeader(apiKey, apiSecret),
            },
            {},
          ),
        );
        const rows = this.extractOrderRows(data);
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
        page += 1;
      }
      return orders;
    } catch (error) {
      throwSyncFailed('NOON', 'getOrders', error);
    }
  }

  async getListings(
    _credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    void _credentials;
    this.logger.debug('Noon getListings: katalog uçları yapılandırılmadı, boş dönülüyor');
    return { items: [], total: 0, page, pageSize: 50 };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const apiSecret = credentials.apiSecret?.trim();
      if (!apiKey || !apiSecret) {
        throw new Error('Noon: apiKey ve apiSecret zorunludur');
      }
      await withRateLimit('NOON', this.rpm(), async () => {
        for (const u of updates) {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${NOON_API_BASE}/catalog/items/${encodeURIComponent(u.barcode)}/price-and-availability`,
              timeout: 25_000,
              data: { availableQuantity: u.quantity },
              ...this.authHeader(apiKey, apiSecret),
            },
            {},
          );
        }
      });
    } catch (error) {
      throwSyncFailed('NOON', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const apiSecret = credentials.apiSecret?.trim();
      if (!apiKey || !apiSecret) {
        throw new Error('Noon: apiKey ve apiSecret zorunludur');
      }
      await withRateLimit('NOON', this.rpm(), async () => {
        for (const u of updates) {
          const sale = u.salePrice;
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${NOON_API_BASE}/catalog/items/${encodeURIComponent(u.barcode)}/price-and-availability`,
              timeout: 25_000,
              data: { sellingPrice: sale },
              ...this.authHeader(apiKey, apiSecret),
            },
            {},
          );
        }
      });
    } catch (error) {
      throwSyncFailed('NOON', 'updatePrice', error);
    }
  }

  /** Stok + fiyat tek istek — PUT /catalog/items/{sku}/price-and-availability */
  async updatePriceAndAvailability(
    credentials: Record<string, string>,
    sku: string,
    sellingPrice: number,
    availableQuantity: number,
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const apiSecret = credentials.apiSecret?.trim();
      if (!apiKey || !apiSecret) {
        throw new Error('Noon: apiKey ve apiSecret zorunludur');
      }
      await withRateLimit('NOON', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url: `${NOON_API_BASE}/catalog/items/${encodeURIComponent(sku)}/price-and-availability`,
            timeout: 25_000,
            data: { sellingPrice, availableQuantity },
            ...this.authHeader(apiKey, apiSecret),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('NOON', 'updatePriceAndAvailability', error);
    }
  }
}
