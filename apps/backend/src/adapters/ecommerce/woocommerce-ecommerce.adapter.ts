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

import { mapRowsToOrders, mapRowsToProducts, normalizeBaseUrl } from './ecommerce-adapter.utils';

const WC_API_PATH = '/wp-json/wc/v3';

@Injectable()
export class WoocommerceEcommerceAdapter implements IEcommerceAdapter {
  readonly platform = 'WOOCOMMERCE';
  private readonly logger = new Logger(WoocommerceEcommerceAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const key = credentials.consumerKey?.trim() ?? '';
    const secret = credentials.consumerSecret?.trim() ?? '';
    const storeUrl = credentials.storeUrl?.trim() ?? credentials.domain?.trim() ?? '';
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    return axios.create({
      baseURL: `${normalizeBaseUrl(storeUrl)}${WC_API_PATH}`,
      headers: { Authorization: `Basic ${auth}` },
      timeout: 30_000,
    });
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const client = this.getClient(credentials);
    const after = (since ?? new Date(Date.now() - 7 * 86_400_000)).toISOString();
    const { data } = await client.get<unknown>('/orders', {
      params: { after, status: 'processing,on-hold', per_page: 100 },
    });
    return mapRowsToOrders(Array.isArray(data) ? data : []);
  }

  async fetchProducts(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<MarketplaceListing[]> {
    const client = this.getClient(credentials);
    const { data } = await client.get<unknown>('/products', {
      params: { per_page: 50, page: page + 1, status: 'publish' },
    });
    return mapRowsToProducts(Array.isArray(data) ? data : []);
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        const { data } = await client.get<unknown[]>('/products', { params: { sku: u.barcode } });
        const row = Array.isArray(data) ? data[0] : undefined;
        const id = row && typeof row === 'object' && row !== null && 'id' in row ? row.id : undefined;
        if (id) {
          await client.put(`/products/${String(id)}`, {
            stock_quantity: u.quantity,
            manage_stock: true,
          });
        }
      } catch (error) {
        this.logger.warn('WooCommerce stok güncellemesi başarısız', {
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
        const { data } = await client.get<unknown[]>('/products', { params: { sku: u.barcode } });
        const row = Array.isArray(data) ? data[0] : undefined;
        const id = row && typeof row === 'object' && row !== null && 'id' in row ? row.id : undefined;
        if (id) {
          await client.put(`/products/${String(id)}`, {
            regular_price: String(u.listPrice),
            sale_price: String(u.salePrice),
          });
        }
      } catch (error) {
        this.logger.warn('WooCommerce fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.getClient(credentials).get('/system_status', { timeout: 12_000 });
      return true;
    } catch (error) {
      this.logger.warn('WooCommerce bağlantı testi başarısız', {
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
      this.logger.warn('WooCommerce sipariş listesi alınamadı', {
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
      const { data, headers } = await client.get<unknown>('/products', {
        params: { per_page: pageSize, page: page + 1, status: 'publish' },
      });
      const rows = Array.isArray(data) ? data : [];
      const items = mapRowsToProducts(rows);
      const total = parseInt(headers['x-wp-total'] ?? String(items.length), 10);
      return {
        items,
        total: Number.isFinite(total) ? total : items.length,
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.warn('WooCommerce ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }
}
