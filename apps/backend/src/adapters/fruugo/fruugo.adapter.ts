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
import type { FruugoOrder, FruugoOrderLine, FruugoProduct } from './fruugo.types';

const FRUUGO_API_BASE = 'https://fulfillment.fruugo.com';

@Injectable()
export class FruugoAdapter implements IMarketplaceAdapter {
  readonly platform = 'FRUUGO';
  private readonly logger = new Logger(FruugoAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.FRUUGO ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private resolveAuth(credentials: Record<string, string>): Pick<AxiosRequestConfig, 'auth' | 'headers'> {
    const username =
      credentials.username?.trim() ??
      credentials.apiKey?.trim();
    const password = credentials.password?.trim();
    if (!username || !password) {
      throw new Error('Fruugo: username ve password zorunludur');
    }
    const basic = Buffer.from(`${username}:${password}`).toString('base64');
    return {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
  }

  private mapOrder(row: FruugoOrder): MarketplaceOrder | null {
    const idRaw = row.orderId ?? row.id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const createdRaw = row.orderDate ?? row.createdAt;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const lines = row.lines ?? row.items ?? [];
    return {
      platformOrderId: String(idRaw),
      status: typeof row.status === 'string' ? row.status : 'new',
      customerName:
        typeof row.customerName === 'string' ? row.customerName : '—',
      items: lines.map((l: FruugoOrderLine, i) => {
        const sku =
          typeof l.sku === 'string'
            ? l.sku
            : typeof l.productId === 'string'
              ? l.productId
              : `line-${String(i)}`;
        return {
          sku,
          barcode: sku,
          quantity:
            typeof l.quantity === 'number' && Number.isFinite(l.quantity)
              ? Math.max(0, Math.round(l.quantity))
              : 1,
          unitPrice: parseMoney(l.unitPrice),
          platformItemId: sku,
          productName: typeof l.name === 'string' ? l.name : undefined,
        };
      }),
      totalAmount: parseMoney(row.total),
      currency: typeof row.currency === 'string' ? row.currency : 'EUR',
      createdAt,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const fromDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      await withRateLimit('FRUUGO', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${FRUUGO_API_BASE}/orders.json`,
            timeout: 12_000,
            params: { fromDate, status: 'new' },
            ...this.resolveAuth(credentials),
          },
          { maxRetries: 1 },
        );
      });
      return true;
    } catch (error) {
      this.logger.warn('Fruugo bağlantı testi başarısız', {
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
      const fromDate =
        since !== undefined
          ? since.toISOString().slice(0, 10)
          : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const data = await withRateLimit('FRUUGO', this.rpm(), async () =>
        axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${FRUUGO_API_BASE}/orders.json`,
            timeout: 25_000,
            params: { fromDate, status: 'new' },
            ...this.resolveAuth(credentials),
          },
          {},
        ),
      );
      return normalizeOrdersRows(data)
        .map((r) => this.mapOrder(r as FruugoOrder))
        .filter((x): x is MarketplaceOrder => x !== null);
    } catch (error) {
      throwSyncFailed(this.platform, 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const pageSize = 50;
      const data = await withRateLimit('FRUUGO', this.rpm(), async () =>
        axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${FRUUGO_API_BASE}/products`,
            timeout: 25_000,
            params: { page, pageSize },
            ...this.resolveAuth(credentials),
          },
          {},
        ),
      );
      const { rows, total } = normalizeProductRows(data);
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? (row as FruugoProduct) : {};
        const idRaw = p.productId ?? p.id ?? p.sku;
        const id =
          idRaw !== undefined && idRaw !== null ? String(idRaw) : `row-${i}`;
        const title = typeof p.title === 'string' ? p.title : id;
        const sale = parseMoney(p.price);
        const qty =
          typeof p.stock === 'number' && Number.isFinite(p.stock)
            ? Math.max(0, Math.round(p.stock))
            : 0;
        return {
          platformProductId: id,
          barcode: id,
          title,
          quantity: qty,
          salePrice: sale,
          listPrice: sale,
          approved: true,
          images: [],
        };
      });
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize,
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
      const currency = credentials.currency?.trim() ?? 'EUR';
      await withRateLimit('FRUUGO', this.rpm(), async () => {
        for (const u of updates) {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${FRUUGO_API_BASE}/products/${encodeURIComponent(u.barcode)}`,
              timeout: 25_000,
              data: { stock: u.quantity, currency },
              ...this.resolveAuth(credentials),
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
      const currency = credentials.currency?.trim() ?? 'EUR';
      await withRateLimit('FRUUGO', this.rpm(), async () => {
        for (const u of updates) {
          const price = u.salePrice > 0 ? u.salePrice : u.listPrice;
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${FRUUGO_API_BASE}/products/${encodeURIComponent(u.barcode)}`,
              timeout: 25_000,
              data: { price, currency },
              ...this.resolveAuth(credentials),
            },
            {},
          );
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }

  /** Kargo bildirimi — POST /orders/{orderId}/dispatch */
  async shipOrder(
    credentials: Record<string, string>,
    orderId: string,
    trackingNumber: string,
    shippingMethod = 'standard',
  ): Promise<void> {
    try {
      await withRateLimit('FRUUGO', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${FRUUGO_API_BASE}/orders/${encodeURIComponent(orderId)}/dispatch`,
            timeout: 25_000,
            data: { trackingNumber, shippingMethod },
            ...this.resolveAuth(credentials),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'shipOrder', error);
    }
  }
}
