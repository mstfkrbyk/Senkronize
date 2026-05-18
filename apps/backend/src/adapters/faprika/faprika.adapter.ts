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
import { normalizeOrdersRows, normalizeProductRows, parseMoney } from '../stub-helpers';
import type { FaprikaJson } from './faprika.types';

const FAPRIKA_BASE = 'https://api.faprika.com/v1';

@Injectable()
export class FaprikaAdapter implements IMarketplaceAdapter {
  readonly platform = 'FAPRIKA';
  private readonly logger = new Logger(FaprikaAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.FAPRIKA ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private headers(apiKey: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
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
          url: `${FAPRIKA_BASE}/me`,
          timeout: 12_000,
          ...this.headers(apiKey),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch {
      try {
        const apiKey = credentials.apiKey?.trim();
        if (!apiKey) {
          return false;
        }
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${FAPRIKA_BASE}/orders`,
            params: { limit: 1 },
            timeout: 12_000,
            ...this.headers(apiKey),
          },
          { maxRetries: 1 },
        );
        return true;
      } catch (error) {
        this.logger.warn('Faprika bağlantı testi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        return false;
      }
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      return [];
    }
    const sinceDate = since ?? new Date(Date.now() - 7 * 86_400_000);
    try {
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${FAPRIKA_BASE}/orders`,
            params: { limit: 100, since: sinceDate.toISOString() },
            timeout: 25_000,
            ...this.headers(apiKey),
          },
          { maxRetries: 2 },
        );
      });
      const rows = normalizeOrdersRows(data);
      return rows
        .map((row) => this.mapOrder(row as FaprikaJson))
        .filter((o): o is MarketplaceOrder => o !== null);
    } catch (error) {
      this.logger.warn('Faprika sipariş çekme başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  private mapOrder(row: FaprikaJson): MarketplaceOrder | null {
    if (typeof row !== 'object' || row === null) {
      return null;
    }
    const o = row;
    const id = o.id ?? o.orderId ?? o.order_id;
    if (id === undefined || id === null) {
      return null;
    }
    const itemsRaw = o.items ?? o.lines ?? o.products;
    const lines = Array.isArray(itemsRaw) ? itemsRaw : [];
    const items = lines.map((li: unknown) => {
      if (typeof li !== 'object' || li === null) {
        return {
          sku: '',
          barcode: '',
          quantity: 0,
          unitPrice: 0,
          platformItemId: '',
        };
      }
      const l = li as Record<string, unknown>;
      const sku = String(l.sku ?? l.barcode ?? '');
      return {
        sku,
        barcode: sku || String(l.id ?? ''),
        quantity: parseMoney(l.quantity),
        unitPrice: parseMoney(l.price ?? l.unitPrice),
        platformItemId: String(l.id ?? sku),
        productName: typeof l.name === 'string' ? l.name : undefined,
      };
    });
    return {
      platformOrderId: String(id),
      status: String(o.status ?? ''),
      customerName: String(o.customerName ?? o.customer_name ?? '—'),
      items,
      totalAmount: parseMoney(o.total ?? o.totalAmount),
      currency: String(o.currency ?? 'TRY'),
      createdAt: new Date(
        String(o.createdAt ?? o.created_at ?? Date.now()),
      ).toISOString(),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const pageSize = 50;
    try {
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${FAPRIKA_BASE}/products`,
            params: { limit: pageSize, page: page + 1 },
            timeout: 25_000,
            ...this.headers(apiKey),
          },
          { maxRetries: 2 },
        );
      });
      const { rows, total } = normalizeProductRows(data);
      const items = rows
        .map((r) => this.mapListing(r as FaprikaJson))
        .filter((l): l is MarketplaceListing => l !== null);
      return { items, total: total ?? items.length, page, pageSize };
    } catch (error) {
      this.logger.warn('Faprika ürün listesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }

  private mapListing(row: FaprikaJson): MarketplaceListing | null {
    if (typeof row !== 'object' || row === null) {
      return null;
    }
    const p = row;
    const id = p.id ?? p.productId ?? p.sku;
    if (id === undefined || id === null) {
      return null;
    }
    const sku = String(p.sku ?? p.barcode ?? id);
    const price = parseMoney(p.price ?? p.salePrice);
    return {
      platformProductId: String(id),
      barcode: sku,
      title: String(p.title ?? p.name ?? sku),
      quantity: parseMoney(p.quantity ?? p.stock),
      salePrice: price,
      listPrice: parseMoney(p.listPrice ?? p.price),
      approved: p.active !== false,
      images: Array.isArray(p.images)
        ? (p.images as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      return;
    }
    for (const u of updates) {
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PATCH',
              url: `${FAPRIKA_BASE}/inventory`,
              data: { sku: u.barcode, quantity: u.quantity },
              timeout: 15_000,
              ...this.headers(apiKey),
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('Faprika stok güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      return;
    }
    for (const u of updates) {
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PATCH',
              url: `${FAPRIKA_BASE}/products/price`,
              data: {
                sku: u.barcode,
                salePrice: u.salePrice,
                listPrice: u.listPrice,
              },
              timeout: 15_000,
              ...this.headers(apiKey),
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('Faprika fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
