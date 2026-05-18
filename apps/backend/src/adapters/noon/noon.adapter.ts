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

  private headers(apiKey: string): { headers: Record<string, string> } {
    return {
      headers: {
        'Api-Key': apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };
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
          url: `${NOON_API_BASE}/orders`,
          timeout: 12_000,
          params: { page_size: 1 },
          ...this.headers(apiKey),
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
      status: typeof row.status === 'string' ? row.status : 'NEW',
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
      if (!apiKey) {
        throw new Error('Noon: Api-Key zorunludur');
      }
      return await withRateLimit('NOON', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${NOON_API_BASE}/orders`,
            timeout: 25_000,
            params: {
              page_size: 50,
              ...(since !== undefined ? { updated_from: since.toISOString() } : {}),
            },
            ...this.headers(apiKey),
          },
          {},
        );
        const rows = this.extractOrderRows(data);
        return rows
          .map((r) => this.mapOrder(r))
          .filter((x): x is MarketplaceOrder => x !== null);
      });
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
      if (!apiKey) {
        throw new Error('Noon: Api-Key zorunludur');
      }
      await withRateLimit('NOON', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${NOON_API_BASE}/catalog/stock`,
            timeout: 25_000,
            data: {
              items: updates.map((u) => ({
                partner_sku: u.barcode,
                stock: u.quantity,
              })),
            },
            ...this.headers(apiKey),
          },
          {},
        );
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
      if (!apiKey) {
        throw new Error('Noon: Api-Key zorunludur');
      }
      await withRateLimit('NOON', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${NOON_API_BASE}/catalog/price`,
            timeout: 25_000,
            data: {
              items: updates.map((u) => ({
                partner_sku: u.barcode,
                sale_price: u.salePrice,
                list_price: u.listPrice > 0 ? u.listPrice : u.salePrice,
              })),
            },
            ...this.headers(apiKey),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('NOON', 'updatePrice', error);
    }
  }
}
