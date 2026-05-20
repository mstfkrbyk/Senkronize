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

import { getOAuth2ClientCredentialsToken } from '../erp/erp-adapter.utils';
import {
  mapRowsToOrders,
  mapRowsToProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
  totalFromPayload,
} from './ecommerce-adapter.utils';

export interface EcommerceOAuth2AdapterConfig {
  platform: string;
  label: string;
  defaultBaseUrl: string;
  tokenUrl?: string;
  productsPath?: string;
  ordersPath?: string;
  resolveBaseUrl?: (credentials: Record<string, string>) => string;
}

export abstract class EcommerceOAuth2AdapterBase implements IEcommerceAdapter {
  abstract readonly config: EcommerceOAuth2AdapterConfig;
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
      this.config.resolveBaseUrl?.(credentials) ||
      this.config.defaultBaseUrl;
    return normalizeBaseUrl(raw);
  }

  protected async resolveToken(credentials: Record<string, string>): Promise<string> {
    const accessToken = credentials.accessToken?.trim();
    if (accessToken) {
      return accessToken;
    }
    const clientId = credentials.clientId?.trim() ?? credentials.apiKey?.trim() ?? '';
    const clientSecret = credentials.clientSecret?.trim() ?? credentials.apiSecret?.trim() ?? '';
    if (!clientId || !clientSecret) {
      throw new Error(`${this.config.label}: accessToken veya clientId/clientSecret zorunlu`);
    }
    const base = this.resolveBase(credentials);
    const tokenUrl = this.config.tokenUrl ?? `${base}/oauth/token`;
    return getOAuth2ClientCredentialsToken(
      `${this.config.platform}:${clientId}`,
      tokenUrl,
      clientId,
      clientSecret,
    );
  }

  protected async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const token = await this.resolveToken(credentials);
    return axios.create({
      baseURL: this.resolveBase(credentials),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const client = await this.getClient(credentials);
    const path = this.config.ordersPath ?? '/orders';
    const params: Record<string, string | number> = { limit: 100 };
    if (since) {
      params.since = since.toISOString();
    }
    const { data } = await client.get<unknown>(path, { params });
    return mapRowsToOrders(normalizeArrayPayload(data));
  }

  async fetchProducts(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<MarketplaceListing[]> {
    const client = await this.getClient(credentials);
    const path = this.config.productsPath ?? '/products';
    const { data } = await client.get<unknown>(path, {
      params: { limit: 50, page: page + 1 },
    });
    return mapRowsToProducts(normalizeArrayPayload(data));
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = await this.getClient(credentials);
    for (const u of updates) {
      try {
        await client.put(`/products/${encodeURIComponent(u.barcode)}/stock`, {
          stockAmount: u.quantity,
          quantity: u.quantity,
        });
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
    const client = await this.getClient(credentials);
    for (const u of updates) {
      try {
        await client.put(`/products/${encodeURIComponent(u.barcode)}`, {
          price: u.salePrice,
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
      const client = await this.getClient(credentials);
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
      const client = await this.getClient(credentials);
      const path = this.config.productsPath ?? '/products';
      const { data } = await client.get<unknown>(path, {
        params: { limit: pageSize, page: page + 1 },
      });
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
