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
import type { UniposJson } from './unipos.types';

const UNIPOS_BASE = 'https://api.unipos.com.tr/v1';

@Injectable()
export class UniposAdapter implements IMarketplaceAdapter {
  readonly platform = 'UNIPOS';
  private readonly logger = new Logger(UniposAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.UNIPOS ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private auth(accessToken: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const token = credentials.accessToken?.trim();
      if (!token) {
        return false;
      }
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${UNIPOS_BASE}/me`,
          timeout: 12_000,
          ...this.auth(token),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch {
      try {
        const token = credentials.accessToken?.trim();
        if (!token) {
          return false;
        }
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${UNIPOS_BASE}/orders`,
            params: { limit: 1 },
            timeout: 12_000,
            ...this.auth(token),
          },
          { maxRetries: 1 },
        );
        return true;
      } catch (error) {
        this.logger.warn('Unipos bağlantı testi başarısız', {
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
    const token = credentials.accessToken?.trim();
    if (!token) {
      return [];
    }
    const sinceDate = since ?? new Date(Date.now() - 7 * 86_400_000);
    try {
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${UNIPOS_BASE}/orders`,
            params: { limit: 100, since: sinceDate.toISOString() },
            timeout: 25_000,
            ...this.auth(token),
          },
          { maxRetries: 2 },
        );
      });
      const rows = normalizeOrdersRows(data);
      return rows
        .map((row) => this.mapOrder(row as UniposJson))
        .filter((o): o is MarketplaceOrder => o !== null);
    } catch (error) {
      this.logger.warn('Unipos sipariş çekme başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  private mapOrder(row: UniposJson): MarketplaceOrder | null {
    if (typeof row !== 'object' || row === null) {
      return null;
    }
    const o = row;
    const id = o.id ?? o.orderId;
    if (id === undefined || id === null) {
      return null;
    }
    const itemsRaw = o.items ?? o.lines ?? o.details;
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
        unitPrice: parseMoney(l.unitPrice ?? l.price),
        platformItemId: String(l.id ?? sku),
        productName: typeof l.productName === 'string' ? l.productName : undefined,
      };
    });
    return {
      platformOrderId: String(id),
      status: String(o.status ?? ''),
      customerName: String(o.customerName ?? o.customer ?? '—'),
      items,
      totalAmount: parseMoney(o.totalAmount ?? o.total),
      currency: String(o.currency ?? 'TRY'),
      createdAt: new Date(
        String(o.createdAt ?? o.date ?? Date.now()),
      ).toISOString(),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const token = credentials.accessToken?.trim();
    if (!token) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const pageSize = 50;
    try {
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${UNIPOS_BASE}/products`,
            params: { limit: pageSize, page: page + 1 },
            timeout: 25_000,
            ...this.auth(token),
          },
          { maxRetries: 2 },
        );
      });
      const { rows, total } = normalizeProductRows(data);
      const items = rows
        .map((r) => this.mapListing(r as UniposJson))
        .filter((l): l is MarketplaceListing => l !== null);
      return { items, total: total ?? items.length, page, pageSize };
    } catch (error) {
      this.logger.warn('Unipos ürün listesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }

  private mapListing(row: UniposJson): MarketplaceListing | null {
    if (typeof row !== 'object' || row === null) {
      return null;
    }
    const p = row;
    const id = p.id ?? p.productId ?? p.sku;
    if (id === undefined || id === null) {
      return null;
    }
    const sku = String(p.sku ?? p.barcode ?? id);
    const price = parseMoney(p.salePrice ?? p.price);
    return {
      platformProductId: String(id),
      barcode: sku,
      title: String(p.name ?? p.title ?? sku),
      quantity: parseMoney(p.stockQuantity ?? p.quantity),
      salePrice: price,
      listPrice: parseMoney(p.listPrice ?? p.price),
      approved: p.status !== 'PASSIVE',
      images: [],
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const token = credentials.accessToken?.trim();
    if (!token) {
      return;
    }
    for (const u of updates) {
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${UNIPOS_BASE}/products/stock`,
              data: { barcode: u.barcode, quantity: u.quantity },
              timeout: 15_000,
              ...this.auth(token),
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('Unipos stok güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const token = credentials.accessToken?.trim();
    if (!token) {
      return;
    }
    for (const u of updates) {
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${UNIPOS_BASE}/products/price`,
              data: {
                barcode: u.barcode,
                salePrice: u.salePrice,
                listPrice: u.listPrice,
              },
              timeout: 15_000,
              ...this.auth(token),
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('Unipos fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
