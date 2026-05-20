import { Injectable, Logger } from '@nestjs/common';
import type {
  IEcommerceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { axiosWithRetry } from '../../common/utils/http-retry';
import {
  mapRowsToOrders,
  mapRowsToProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
} from './ecommerce-adapter.utils';

@Injectable()
export class OpencartEcommerceAdapter implements IEcommerceAdapter {
  readonly platform = 'OPENCART';
  private readonly logger = new Logger(OpencartEcommerceAdapter.name);

  private indexUrl(storeUrl: string): string {
    return `${normalizeBaseUrl(storeUrl)}/index.php`;
  }

  private headers(credentials: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-OC-RESTADMIN-ID': credentials.apiKey?.trim() ?? '',
    };
    const secret = credentials.apiSecret?.trim();
    if (secret) {
      headers['X-OC-RESTADMIN-KEY'] = secret;
    }
    const token = credentials.sessionToken?.trim();
    if (token) {
      headers['X-OC-RESTADMIN-TOKEN'] = token;
    }
    return headers;
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const storeUrl = credentials.storeUrl?.trim() ?? credentials.domain?.trim() ?? '';
    const params: Record<string, string | number> = {
      route: 'api/order/orders',
      limit: 100,
    };
    if (since) {
      params.date_from = since.toISOString().slice(0, 10);
    }
    const data = await axiosWithRetry<unknown>(
      {
        method: 'GET',
        url: this.indexUrl(storeUrl),
        params,
        headers: this.headers(credentials),
        timeout: 25_000,
      },
      { maxRetries: 2 },
    );
    return mapRowsToOrders(normalizeArrayPayload(data));
  }

  async fetchProducts(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<MarketplaceListing[]> {
    const storeUrl = credentials.storeUrl?.trim() ?? credentials.domain?.trim() ?? '';
    const data = await axiosWithRetry<unknown>(
      {
        method: 'GET',
        url: this.indexUrl(storeUrl),
        params: {
          route: 'api/product/products',
          limit: 50,
          page: page + 1,
        },
        headers: this.headers(credentials),
        timeout: 25_000,
      },
      { maxRetries: 2 },
    );
    return mapRowsToProducts(normalizeArrayPayload(data));
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const storeUrl = credentials.storeUrl?.trim() ?? credentials.domain?.trim() ?? '';
    for (const u of updates) {
      try {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url: this.indexUrl(storeUrl),
            params: { route: `api/product/stock/${encodeURIComponent(u.barcode)}` },
            data: { quantity: u.quantity },
            headers: this.headers(credentials),
            timeout: 15_000,
          },
          { maxRetries: 2 },
        );
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
    const storeUrl = credentials.storeUrl?.trim() ?? credentials.domain?.trim() ?? '';
    for (const u of updates) {
      try {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url: this.indexUrl(storeUrl),
            params: { route: `api/product/price/${encodeURIComponent(u.barcode)}` },
            data: { price: u.salePrice, special: u.salePrice },
            headers: this.headers(credentials),
            timeout: 15_000,
          },
          { maxRetries: 2 },
        );
      } catch (error) {
        this.logger.warn('OpenCart fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const storeUrl = credentials.storeUrl?.trim() ?? credentials.domain?.trim() ?? '';
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: this.indexUrl(storeUrl),
          params: { route: 'api/product/products', limit: 1 },
          headers: this.headers(credentials),
          timeout: 12_000,
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
    try {
      return await this.fetchOrders(credentials, since);
    } catch (error) {
      this.logger.warn('OpenCart sipariş listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const pageSize = 50;
    try {
      const items = await this.fetchProducts(credentials, page);
      return { items, total: items.length, page, pageSize };
    } catch (error) {
      this.logger.warn('OpenCart ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }
}
