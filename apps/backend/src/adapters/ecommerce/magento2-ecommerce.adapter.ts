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

import { axiosWithRetry } from '../../common/utils/http-retry';
import {
  mapRowsToOrders,
  mapRowsToProducts,
  normalizeArrayPayload,
  normalizeBaseUrl,
  totalFromPayload,
} from './ecommerce-adapter.utils';

@Injectable()
export class Magento2EcommerceAdapter implements IEcommerceAdapter {
  readonly platform = 'MAGENTO2';
  private readonly logger = new Logger(Magento2EcommerceAdapter.name);

  private restBase(storeUrl: string): string {
    return `${normalizeBaseUrl(storeUrl)}/rest/V1`;
  }

  private async fetchAdminToken(
    base: string,
    username: string,
    password: string,
  ): Promise<string> {
    const raw = await axiosWithRetry<string>(
      {
        method: 'POST',
        url: `${base}/integration/admin/token`,
        data: { username, password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 20_000,
      },
      { maxRetries: 2 },
    );
    if (typeof raw !== 'string' || raw.length === 0) {
      throw new Error('Magento 2: admin token alınamadı');
    }
    return raw.replace(/^"|"$/g, '');
  }

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const storeUrl = credentials.storeUrl?.trim() ?? credentials.domain?.trim() ?? '';
    const base = this.restBase(storeUrl);
    const adminToken = credentials.adminToken?.trim();
    const token =
      adminToken ??
      (await this.fetchAdminToken(
        base,
        credentials.username?.trim() ?? '',
        credentials.password?.trim() ?? '',
      ));
    return axios.create({
      baseURL: base,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
    });
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const client = await this.getClient(credentials);
    const params: Record<string, string> = {
      'searchCriteria[pageSize]': '100',
    };
    if (since) {
      params['searchCriteria[filter_groups][0][filters][0][field]'] = 'created_at';
      params['searchCriteria[filter_groups][0][filters][0][value]'] = since.toISOString();
      params['searchCriteria[filter_groups][0][filters][0][condition_type]'] = 'gt';
    }
    const { data } = await client.get<unknown>('/orders', { params });
    return mapRowsToOrders(normalizeArrayPayload(data));
  }

  async fetchProducts(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<MarketplaceListing[]> {
    const client = await this.getClient(credentials);
    const { data } = await client.get<unknown>('/products', {
      params: {
        'searchCriteria[pageSize]': 50,
        'searchCriteria[currentPage]': page + 1,
      },
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
        await client.put(`/products/${encodeURIComponent(u.barcode)}/stockItems/1`, {
          stockItem: { qty: u.quantity, is_in_stock: u.quantity > 0 },
        });
      } catch (error) {
        this.logger.warn('Magento 2 stok güncellemesi başarısız', {
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
          product: {
            price: u.salePrice,
            custom_attributes: [
              { attribute_code: 'special_price', value: u.salePrice },
              { attribute_code: 'price', value: u.listPrice },
            ],
          },
        });
      } catch (error) {
        this.logger.warn('Magento 2 fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = await this.getClient(credentials);
      await client.get('/store/storeConfigs', { timeout: 12_000 });
      return true;
    } catch (error) {
      this.logger.warn('Magento 2 bağlantı testi başarısız', {
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
      this.logger.warn('Magento 2 sipariş listesi alınamadı', {
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
      const { data } = await client.get<unknown>('/products', {
        params: {
          'searchCriteria[pageSize]': pageSize,
          'searchCriteria[currentPage]': page + 1,
        },
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
      this.logger.warn('Magento 2 ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }
}
