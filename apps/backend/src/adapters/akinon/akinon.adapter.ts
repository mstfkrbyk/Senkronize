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
import type { AkinonJson } from './akinon.types';

const AKINON_BASE = 'https://api.akinon.com/v1';

@Injectable()
export class AkinonAdapter implements IMarketplaceAdapter {
  readonly platform = 'AKINON';
  private readonly logger = new Logger(AkinonAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.AKINON ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private auth(apiToken: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiToken = credentials.apiToken?.trim() ?? credentials.apiKey?.trim();
      if (!apiToken) {
        return false;
      }
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${AKINON_BASE}/orders/`,
          params: { limit: 1 },
          timeout: 12_000,
          ...this.auth(apiToken),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Akinon bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const apiToken = credentials.apiToken?.trim() ?? credentials.apiKey?.trim();
    if (!apiToken) {
      return [];
    }
    const sinceDate = since ?? new Date(Date.now() - 7 * 86_400_000);
    try {
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${AKINON_BASE}/orders/`,
            params: {
              limit: 100,
              modified_after: sinceDate.toISOString(),
            },
            timeout: 25_000,
            ...this.auth(apiToken),
          },
          { maxRetries: 2 },
        );
      });
      const rows = normalizeOrdersRows(data);
      return rows
        .map((row) => this.mapOrder(row as AkinonJson))
        .filter((o): o is MarketplaceOrder => o !== null);
    } catch (error) {
      this.logger.warn('Akinon sipariş çekme başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  private mapOrder(row: AkinonJson): MarketplaceOrder | null {
    if (typeof row !== 'object' || row === null) {
      return null;
    }
    const o = row;
    const id = o.pk ?? o.id ?? o.number;
    if (id === undefined || id === null) {
      return null;
    }
    const itemsRaw = o.items ?? o.lines ?? o.basket_items;
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
      const sku = String(l.sku ?? l.product_sku ?? '');
      return {
        sku,
        barcode: sku || String(l.product ?? ''),
        quantity: parseMoney(l.quantity),
        unitPrice: parseMoney(l.price ?? l.amount),
        platformItemId: String(l.id ?? sku),
        productName: typeof l.name === 'string' ? l.name : undefined,
      };
    });
    return {
      platformOrderId: String(id),
      status: String(o.status ?? ''),
      customerName: String(
        o.customer_full_name ?? o.customer_name ?? o.email ?? '—',
      ),
      items,
      totalAmount: parseMoney(o.total_amount ?? o.total),
      currency: String(o.currency ?? 'TRY'),
      createdAt: new Date(
        String(o.created_at ?? o.date_placed ?? Date.now()),
      ).toISOString(),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const apiToken = credentials.apiToken?.trim() ?? credentials.apiKey?.trim();
    if (!apiToken) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const pageSize = 50;
    try {
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${AKINON_BASE}/products/`,
            params: { limit: pageSize, page: page + 1 },
            timeout: 25_000,
            ...this.auth(apiToken),
          },
          { maxRetries: 2 },
        );
      });
      const { rows, total } = normalizeProductRows(data);
      const items = rows
        .map((r) => this.mapListing(r as AkinonJson))
        .filter((l): l is MarketplaceListing => l !== null);
      return { items, total: total ?? items.length, page, pageSize };
    } catch (error) {
      this.logger.warn('Akinon ürün listesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }

  private mapListing(row: AkinonJson): MarketplaceListing | null {
    if (typeof row !== 'object' || row === null) {
      return null;
    }
    const p = row;
    const id = p.pk ?? p.id ?? p.sku;
    if (id === undefined || id === null) {
      return null;
    }
    const sku = String(p.sku ?? p.base_code ?? id);
    const price = parseMoney(p.price ?? p.retail_price);
    return {
      platformProductId: String(id),
      barcode: sku,
      title: String(p.name ?? p.label ?? sku),
      quantity: parseMoney(p.stock_quantity ?? p.quantity),
      salePrice: price,
      listPrice: parseMoney(p.list_price ?? p.price),
      approved: p.is_published !== false,
      images: Array.isArray(p.images)
        ? (p.images as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const apiToken = credentials.apiToken?.trim() ?? credentials.apiKey?.trim();
    if (!apiToken) {
      return;
    }
    for (const u of updates) {
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PATCH',
              url: `${AKINON_BASE}/products/${encodeURIComponent(u.barcode)}/stock/`,
              data: { quantity: u.quantity },
              timeout: 15_000,
              ...this.auth(apiToken),
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('Akinon stok güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const apiToken = credentials.apiToken?.trim() ?? credentials.apiKey?.trim();
    if (!apiToken) {
      return;
    }
    for (const u of updates) {
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PATCH',
              url: `${AKINON_BASE}/products/${encodeURIComponent(u.barcode)}/price/`,
              data: { sale_price: u.salePrice, list_price: u.listPrice },
              timeout: 15_000,
              ...this.auth(apiToken),
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('Akinon fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
