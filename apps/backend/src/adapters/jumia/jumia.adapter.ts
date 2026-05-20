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
import { JUMIA_API_BASE } from './jumia.constants';
import { jumiaSign } from './jumia.sign';
import type { JumiaOrderRow } from './jumia.types';

@Injectable()
export class JumiaAdapter implements IMarketplaceAdapter {
  readonly platform = 'JUMIA';
  private readonly logger = new Logger(JumiaAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.JUMIA ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private resolveBase(credentials: Record<string, string>): string {
    const custom = credentials.apiBaseUrl?.trim() ?? credentials.baseUrl?.trim();
    if (custom && custom.length > 0) {
      return custom.replace(/\/+$/, '');
    }
    return JUMIA_API_BASE;
  }

  private requireCreds(credentials: Record<string, string>): {
    apiKey: string;
    apiSecret: string;
  } {
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!apiKey || !apiSecret) {
      throw new Error('Jumia: apiKey ve apiSecret zorunludur');
    }
    return { apiKey, apiSecret };
  }

  private async request<T>(
    credentials: Record<string, string>,
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    options?: { params?: Record<string, string>; body?: unknown },
  ): Promise<T> {
    const { apiKey, apiSecret } = this.requireCreds(credentials);
    const base = this.resolveBase(credentials);
    const params = options?.params ?? {};
    const query = new URLSearchParams(params).toString();
    const pathWithQuery = query.length > 0 ? `${path}?${query}` : path;
    const bodyStr =
      options?.body !== undefined ? JSON.stringify(options.body) : '';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = jumiaSign(apiSecret, method, pathWithQuery, timestamp, bodyStr);
    const url = `${base}${pathWithQuery}`;
    const config = {
      method,
      url,
      timeout: 25_000 as const,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Signature': signature,
        'X-Timestamp': timestamp,
      },
      ...(bodyStr.length > 0 ? { data: options?.body } : {}),
    };
    return axiosWithRetry<T>(config, {});
  }

  private mapOrder(row: JumiaOrderRow, lines: unknown[] = []): MarketplaceOrder | null {
    const idRaw = row.id ?? row.order_id ?? row.order_number;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const createdRaw = row.created_at ?? row.order_date;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const customer =
      typeof row.customer_name === 'string'
        ? row.customer_name
        : typeof row.buyer_name === 'string'
          ? row.buyer_name
          : '—';
    return {
      platformOrderId: String(idRaw),
      status: typeof row.status === 'string' ? row.status : 'processing',
      customerName: customer,
      items: lines.filter(isRecord).map((l, i) => {
        const sku =
          typeof l.sku === 'string'
            ? l.sku
            : typeof l.seller_sku === 'string'
              ? l.seller_sku
              : `line-${String(i)}`;
        return {
          sku,
          barcode: sku,
          quantity:
            typeof l.quantity === 'number' && Number.isFinite(l.quantity)
              ? Math.max(0, Math.round(l.quantity))
              : 1,
          unitPrice: parseMoney(l.price ?? l.unit_price ?? l.item_price),
          platformItemId:
            l.id !== undefined && l.id !== null ? String(l.id) : sku,
          productName:
            typeof l.name === 'string'
              ? l.name
              : typeof l.product_name === 'string'
                ? l.product_name
                : undefined,
        };
      }),
      totalAmount: parseMoney(row.total ?? row.total_amount ?? row.grand_total),
      currency: typeof row.currency === 'string' ? row.currency : 'NGN',
      createdAt,
      cargoTrackingNumber:
        typeof row.tracking_number === 'string' ? row.tracking_number : undefined,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      await withRateLimit('JUMIA', this.rpm(), async () => {
        await this.request<unknown>(credentials, 'GET', '/orders', {
          params: {
            status: 'processing',
            from,
            to,
            page: '1',
            per_page: '1',
          },
        });
      });
      return true;
    } catch (error) {
      this.logger.warn('Jumia bağlantı testi başarısız', {
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
      const orders: MarketplaceOrder[] = [];
      const to = new Date().toISOString().slice(0, 10);
      const from =
        since !== undefined
          ? since.toISOString().slice(0, 10)
          : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      let page = 1;
      const perPage = 50;
      for (;;) {
        const data = await withRateLimit('JUMIA', this.rpm(), async () =>
          this.request<unknown>(credentials, 'GET', '/orders', {
            params: {
              status: 'processing',
              from,
              to,
              page: String(page),
              per_page: String(perPage),
            },
          }),
        );
        const rows = normalizeOrdersRows(data) as JumiaOrderRow[];
        if (rows.length === 0) {
          break;
        }
        for (const row of rows) {
          const orderId = row.id ?? row.order_id ?? row.order_number;
          if (orderId === undefined || orderId === null) {
            continue;
          }
          const itemsData = await withRateLimit('JUMIA', this.rpm(), async () =>
            this.request<unknown>(
              credentials,
              'GET',
              `/orders/${encodeURIComponent(String(orderId))}/items`,
            ),
          );
          const lines = normalizeOrdersRows(itemsData);
          const mapped = this.mapOrder(row, lines);
          if (mapped) {
            orders.push(mapped);
          }
        }
        if (rows.length < perPage) {
          break;
        }
        page += 1;
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
      const perPage = 50;
      const data = await withRateLimit('JUMIA', this.rpm(), async () =>
        this.request<unknown>(credentials, 'GET', '/items', {
          params: {
            page: String(page + 1),
            per_page: String(perPage),
          },
        }),
      );
      const { rows, total } = normalizeProductRows(data);
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const sku =
          typeof p.sku === 'string'
            ? p.sku
            : typeof p.seller_sku === 'string'
              ? p.seller_sku
              : `row-${i}`;
        const title =
          typeof p.name === 'string'
            ? p.name
            : typeof p.title === 'string'
              ? p.title
              : sku;
        const sale = parseMoney(p.price ?? p.sale_price ?? p.special_price);
        const qtyRaw = p.quantity ?? p.stock ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        return {
          platformProductId: sku,
          barcode: sku,
          title,
          quantity,
          salePrice: sale,
          listPrice: parseMoney(p.list_price ?? p.price ?? sale),
          approved: p.status !== 'inactive',
          images: [],
        };
      });
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize: perPage,
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
      await withRateLimit('JUMIA', this.rpm(), async () => {
        for (const u of updates) {
          await this.request<unknown>(
            credentials,
            'PUT',
            `/items/${encodeURIComponent(u.barcode)}/stock`,
            { body: { quantity: u.quantity } },
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
      await withRateLimit('JUMIA', this.rpm(), async () => {
        for (const u of updates) {
          await this.request<unknown>(
            credentials,
            'PUT',
            `/items/${encodeURIComponent(u.barcode)}/price`,
            {
              body: {
                price: u.listPrice > 0 ? u.listPrice : u.salePrice,
                special_price: u.salePrice,
              },
            },
          );
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }

  /** Kargo bildirimi — POST /orders/{orderId}/ship */
  async shipOrder(
    credentials: Record<string, string>,
    orderId: string,
    trackingNumber: string,
    shippingCompany: string,
  ): Promise<void> {
    try {
      await withRateLimit('JUMIA', this.rpm(), async () => {
        await this.request<unknown>(
          credentials,
          'POST',
          `/orders/${encodeURIComponent(orderId)}/ship`,
          {
            body: {
              tracking_number: trackingNumber,
              shipping_company: shippingCompany,
            },
          },
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'shipOrder', error);
    }
  }
}
