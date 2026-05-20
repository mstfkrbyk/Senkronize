import { Logger } from '@nestjs/common';
import type {
  IEcommerceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import {
  isRecord,
  mapRowsToOrders,
  mapRowsToProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
  totalFromPayload,
} from './ecommerce-adapter.utils';

export interface EcommerceApiKeyAdapterConfig {
  platform: string;
  label: string;
  defaultBaseUrl: string;
  productsPath?: string;
  ordersPath?: string;
  stockPath?: (barcode: string) => string;
  pricePath?: (barcode: string) => string;
  resolveBaseUrl?: (credentials: Record<string, string>) => string;
  extraHeaders?: (credentials: Record<string, string>) => Record<string, string>;
  orderParams?: (
    credentials: Record<string, string>,
    since?: Date,
  ) => Record<string, string | number>;
  productParams?: (
    credentials: Record<string, string>,
    page: number,
  ) => Record<string, string | number>;
}

export abstract class EcommerceApiKeyAdapterBase implements IEcommerceAdapter {
  abstract readonly config: EcommerceApiKeyAdapterConfig;
  private _logger?: Logger;

  protected get logger(): Logger {
    if (!this._logger) {
      this._logger = new Logger(this.config.label);
    }
    return this._logger;
  }

  get platform(): string {
    return this.config.platform;
  }

  protected resolveBase(credentials: Record<string, string>): string {
    const raw =
      credentials.baseUrl?.trim() ||
      credentials.apiUrl?.trim() ||
      this.config.resolveBaseUrl?.(credentials) ||
      this.config.defaultBaseUrl;
    return normalizeBaseUrl(raw);
  }

  protected getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim() ?? credentials.apiToken?.trim() ?? '';
    const storeId = credentials.storeId?.trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.extraHeaders?.(credentials),
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
      headers.Authorization = `Bearer ${apiKey}`;
    }
    if (storeId) {
      headers['X-Store-Id'] = storeId;
    }
    return axios.create({
      baseURL: this.resolveBase(credentials),
      headers,
      timeout: 30_000,
    });
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const client = this.getClient(credentials);
    const path = this.config.ordersPath ?? '/orders';
    const params = this.config.orderParams?.(credentials, since) ?? {
      limit: 100,
      ...(since ? { since: since.toISOString() } : {}),
    };
    const { data } = await client.get<unknown>(path, { params });
    return mapRowsToOrders(normalizeArrayPayload(data));
  }

  async fetchProducts(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<MarketplaceListing[]> {
    const client = this.getClient(credentials);
    const path = this.config.productsPath ?? '/products';
    const params = this.config.productParams?.(credentials, page) ?? {
      limit: 50,
      page: page + 1,
    };
    const { data } = await client.get<unknown>(path, { params });
    return mapRowsToProducts(normalizeArrayPayload(data));
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        const path = this.config.stockPath?.(u.barcode) ?? `/products/${encodeURIComponent(u.barcode)}/stock`;
        await client.put(path, { quantity: u.quantity, stockAmount: u.quantity });
      } catch (error) {
        this.logger.warn(`${this.config.label} stok güncellemesi başarısız`, {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        const path = this.config.pricePath?.(u.barcode) ?? `/products/${encodeURIComponent(u.barcode)}`;
        await client.put(path, {
          price: u.salePrice,
          salePrice: u.salePrice,
          listPrice: u.listPrice,
          oldPrice: u.listPrice,
        });
      } catch (error) {
        this.logger.warn(`${this.config.label} fiyat güncellemesi başarısız`, {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = this.getClient(credentials);
      const path = this.config.productsPath ?? '/products';
      await client.get(path, { params: { limit: 1 }, timeout: 12_000 });
      return true;
    } catch (error) {
      this.logger.warn(`${this.config.label} bağlantı testi başarısız`, {
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
      this.logger.warn(`${this.config.label} sipariş listesi alınamadı`, {
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
      const client = this.getClient(credentials);
      const path = this.config.productsPath ?? '/products';
      const params = this.config.productParams?.(credentials, page) ?? {
        limit: pageSize,
        page: page + 1,
      };
      const { data } = await client.get<unknown>(path, { params });
      const rows = normalizeArrayPayload(data);
      const items = mapRowsToProducts(rows);
      return {
        items,
        total: totalFromPayload(data, items.length),
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.warn(`${this.config.label} ürün listesi alınamadı`, {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }
}
