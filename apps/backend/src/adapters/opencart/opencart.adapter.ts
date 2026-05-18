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
import type { OcOrderLine, OcOrderRow, OcProductRow } from './opencart.types';

@Injectable()
export class OpencartAdapter implements IMarketplaceAdapter {
  readonly platform = 'OPENCART';
  private readonly logger = new Logger(OpencartAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.OPENCART ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private indexPhp(storeUrl: string): string {
    return `${storeUrl.replace(/\/+$/, '').trim()}/index.php`;
  }

  private ocHeaders(credentials: Record<string, string>): Pick<AxiosRequestConfig, 'headers'> {
    const id = credentials.apiKey?.trim() ?? '';
    const key = credentials.apiSecret?.trim() ?? '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-OC-RESTADMIN-ID': id,
    };
    if (key.length > 0) {
      headers['X-OC-RESTADMIN-KEY'] = key;
    }
    const token = credentials.sessionToken?.trim();
    if (token && token.length > 0) {
      headers['X-OC-RESTADMIN-TOKEN'] = token;
    }
    return { headers };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const storeUrl = credentials.storeUrl?.trim();
      const apiKey = credentials.apiKey?.trim();
      if (!storeUrl || !apiKey) {
        return false;
      }
      const url = this.indexPhp(storeUrl);
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url,
          params: { route: 'api/product/products', limit: 1 },
          timeout: 12_000,
          ...this.ocHeaders(credentials),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('OpenCart bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!storeUrl || !apiKey) {
      return [];
    }
    const sinceDate = since ?? new Date(Date.now() - 7 * 86_400_000);
    try {
      const url = this.indexPhp(storeUrl);
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            params: {
              route: 'api/order/orders',
              limit: 100,
              page: 1,
            },
            timeout: 25_000,
            ...this.ocHeaders(credentials),
          },
          { maxRetries: 2 },
        );
      });
      const rows = normalizeOrdersRows(data) as OcOrderRow[];
      return rows
        .map((o) => this.mapOrder(o))
        .filter((o) => {
          const t = new Date(o.createdAt).getTime();
          return t >= sinceDate.getTime();
        });
    } catch (error) {
      this.logger.warn('OpenCart sipariş çekme başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  private mapOrder(o: OcOrderRow): MarketplaceOrder {
    const idRaw = o.order_id ?? o.orderId ?? '';
    const first = o.firstname ?? '';
    const last = o.lastname ?? '';
    const customerName = `${first} ${last}`.trim() || '—';
    const lines = Array.isArray(o.products) ? o.products : [];
    const items = lines.map((li: OcOrderLine) => {
      const sku = String(li.sku ?? li.model ?? '');
      const qty = parseMoney(li.quantity);
      const unit = parseMoney(li.price);
      const pid = li.product_id ?? li.productId ?? '';
      return {
        sku,
        barcode: sku || String(pid),
        quantity: qty,
        unitPrice: unit,
        platformItemId: String(pid || sku),
        productName: li.name,
      };
    });
    return {
      platformOrderId: String(idRaw),
      status: String(o.status ?? ''),
      customerName,
      items,
      totalAmount: parseMoney(o.total),
      currency: String(o.currency_code ?? 'TRY'),
      createdAt: new Date(o.date_added ?? Date.now()).toISOString(),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!storeUrl || !apiKey) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const pageSize = 50;
    try {
      const url = this.indexPhp(storeUrl);
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            params: {
              route: 'api/product/products',
              limit: pageSize,
              page: page + 1,
            },
            timeout: 25_000,
            ...this.ocHeaders(credentials),
          },
          { maxRetries: 2 },
        );
      });
      const { rows, total } = normalizeProductRows(data);
      const items = (rows as OcProductRow[])
        .map((p) => this.mapProduct(p))
        .filter((l): l is MarketplaceListing => l !== null);
      return {
        items,
        total: total ?? items.length,
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.warn('OpenCart ürün listesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }

  private mapProduct(p: OcProductRow): MarketplaceListing | null {
    const pid = p.product_id ?? p.productId;
    if (pid === undefined || pid === null) {
      return null;
    }
    const sku = String(p.sku ?? p.model ?? pid);
    const price = parseMoney(p.price);
    const qty = parseMoney(p.quantity);
    const img = typeof p.image === 'string' && p.image.length > 0 ? [p.image] : [];
    return {
      platformProductId: String(pid),
      barcode: sku,
      title: String(p.name ?? sku),
      quantity: qty,
      salePrice: price,
      listPrice: price,
      approved: String(p.status ?? '1') === '1',
      images: img,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!storeUrl || !apiKey) {
      return;
    }
    const url = this.indexPhp(storeUrl);
    for (const u of updates) {
      const productId = u.barcode.trim();
      if (!productId) {
        continue;
      }
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url,
              params: {
                route: 'api/product/product',
                product_id: productId,
              },
              data: { quantity: u.quantity, stock_quantity: u.quantity },
              timeout: 15_000,
              ...this.ocHeaders(credentials),
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('OpenCart stok güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!storeUrl || !apiKey) {
      return;
    }
    const url = this.indexPhp(storeUrl);
    for (const u of updates) {
      const productId = u.barcode.trim();
      if (!productId) {
        continue;
      }
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url,
              params: {
                route: 'api/product/product',
                product_id: productId,
              },
              data: { price: u.salePrice },
              timeout: 15_000,
              ...this.ocHeaders(credentials),
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('OpenCart fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
