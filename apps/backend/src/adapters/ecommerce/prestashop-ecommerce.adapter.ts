import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type {
  IEcommerceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  mapRowsToOrders,
  mapRowsToProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
} from './ecommerce-adapter.utils';

@Injectable()
export class PrestashopEcommerceAdapter implements IEcommerceAdapter {
  readonly platform = 'PRESTASHOP';
  private readonly logger = new Logger(PrestashopEcommerceAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim() ?? '';
    const storeUrl = credentials.storeUrl?.trim() ?? credentials.domain?.trim() ?? '';
    const token = Buffer.from(`${apiKey}:`, 'utf8').toString('base64');
    return axios.create({
      baseURL: `${normalizeBaseUrl(storeUrl)}/api`,
      headers: {
        Authorization: `Basic ${token}`,
        'Output-Format': 'JSON',
      },
      timeout: 30_000,
    });
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const client = this.getClient(credentials);
    const params: Record<string, string> = {
      display: 'full',
      limit: '100',
    };
    if (since) {
      params['filter[date_add]'] = `[>${since.toISOString().slice(0, 19)}]`;
    }
    const { data } = await client.get<unknown>('/orders', { params });
    return mapRowsToOrders(normalizeArrayPayload(data));
  }

  async fetchProducts(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<MarketplaceListing[]> {
    const client = this.getClient(credentials);
    const offset = page * 50;
    const { data } = await client.get<unknown>('/products', {
      params: { display: 'full', limit: '50', offset: String(offset) },
    });
    return mapRowsToProducts(normalizeArrayPayload(data));
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        await client.put(`/stock_availables/${encodeURIComponent(u.barcode)}`, {
          stock_available: { quantity: u.quantity },
        });
      } catch (error) {
        this.logger.warn('PrestaShop stok güncellemesi başarısız', {
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
        await client.put(`/products/${encodeURIComponent(u.barcode)}`, {
          product: { price: String(u.salePrice) },
        });
      } catch (error) {
        this.logger.warn('PrestaShop fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.getClient(credentials).get('/products', {
        params: { limit: 1 },
        timeout: 12_000,
      });
      return true;
    } catch (error) {
      this.logger.warn('PrestaShop bağlantı testi başarısız', {
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
      this.logger.warn('PrestaShop sipariş listesi alınamadı', {
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
      this.logger.warn('PrestaShop ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }
}
