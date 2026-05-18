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
import type {
  MagentoOrder,
  MagentoOrderItem,
  MagentoProduct,
  MagentoProductsEnvelope,
} from './magento.types';

@Injectable()
export class MagentoAdapter implements IMarketplaceAdapter {
  readonly platform = 'MAGENTO';
  private readonly logger = new Logger(MagentoAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.MAGENTO ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private restBase(storeUrl: string): string {
    const u = storeUrl.replace(/\/+$/, '').trim();
    return `${u}/rest/V1`;
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
      throw new Error('Magento: admin token alınamadı');
    }
    return raw.replace(/^"|"$/g, '');
  }

  private authHeader(token: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const storeUrl = credentials.storeUrl?.trim();
      const username = credentials.username?.trim();
      const password = credentials.password?.trim();
      if (!storeUrl || !username || !password) {
        return false;
      }
      const base = this.restBase(storeUrl);
      const token = await this.fetchAdminToken(base, username, password);
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${base}/store/storeConfigs`,
          timeout: 15_000,
          ...this.authHeader(token),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Magento bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private async getToken(credentials: Record<string, string>): Promise<string | null> {
    const storeUrl = credentials.storeUrl?.trim();
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    if (!storeUrl || !username || !password) {
      return null;
    }
    const base = this.restBase(storeUrl);
    return await this.fetchAdminToken(base, username, password);
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const storeUrl = credentials.storeUrl?.trim();
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    if (!storeUrl || !username || !password) {
      return [];
    }
    const base = this.restBase(storeUrl);
    const sinceDate = since ?? new Date(Date.now() - 7 * 86_400_000);
    const from = sinceDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
    try {
      const token = await this.fetchAdminToken(base, username, password);
      const qs = new URLSearchParams({
        'searchCriteria[pageSize]': '100',
        'searchCriteria[currentPage]': '1',
        'searchCriteria[filter_groups][0][filters][0][field]': 'created_at',
        'searchCriteria[filter_groups][0][filters][0][value]': from,
        'searchCriteria[filter_groups][0][filters][0][condition_type]': 'from',
      });
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<{ items?: MagentoOrder[] }>(
          {
            method: 'GET',
            url: `${base}/orders?${qs.toString()}`,
            timeout: 25_000,
            ...this.authHeader(token),
          },
          { maxRetries: 2 },
        );
      });
      const rows = Array.isArray(data.items) ? data.items : [];
      return rows.map((o) => this.mapOrder(o));
    } catch (error) {
      this.logger.warn('Magento sipariş çekme başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  private mapOrder(o: MagentoOrder): MarketplaceOrder {
    const first = o.customer_firstname ?? '';
    const last = o.customer_lastname ?? '';
    const customerName = `${first} ${last}`.trim() || '—';
    const items = (o.items ?? []).map((li: MagentoOrderItem) => {
      const sku = String(li.sku ?? '');
      const qty = Number(li.qty_ordered ?? 0);
      const unit = Number(li.price ?? 0);
      const idPart = li.item_id ?? sku;
      return {
        sku,
        barcode: sku || String(idPart),
        quantity: Number.isFinite(qty) ? qty : 0,
        unitPrice: Number.isFinite(unit) ? unit : 0,
        platformItemId: String(li.item_id ?? sku),
        productName: li.name,
      };
    });
    const total = Number(o.grand_total ?? 0);
    return {
      platformOrderId: String(o.increment_id ?? o.entity_id ?? ''),
      status: String(o.status ?? ''),
      customerName,
      items,
      totalAmount: Number.isFinite(total) ? total : 0,
      currency: String(o.order_currency_code ?? 'TRY'),
      createdAt: new Date(o.created_at ?? Date.now()).toISOString(),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const storeUrl = credentials.storeUrl?.trim();
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    if (!storeUrl || !username || !password) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const base = this.restBase(storeUrl);
    const pageSize = 50;
    try {
      const token = await this.fetchAdminToken(base, username, password);
      const qs = new URLSearchParams({
        'searchCriteria[pageSize]': String(pageSize),
        'searchCriteria[currentPage]': String(page + 1),
      });
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<MagentoProductsEnvelope>(
          {
            method: 'GET',
            url: `${base}/products?${qs.toString()}`,
            timeout: 25_000,
            ...this.authHeader(token),
          },
          { maxRetries: 2 },
        );
      });
      const rows = Array.isArray(data.items) ? data.items : [];
      const items = rows.map((p) => this.mapProduct(p));
      return {
        items,
        total: items.length,
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.warn('Magento ürün listesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }

  private mapProduct(p: MagentoProduct): MarketplaceListing {
    const sku = String(p.sku ?? p.id ?? '');
    const price = Number(p.price ?? 0);
    const qty = Number(p.extension_attributes?.stock_item?.qty ?? 0);
    return {
      platformProductId: String(p.sku ?? p.id ?? ''),
      barcode: sku,
      title: String(p.name ?? sku),
      quantity: Number.isFinite(qty) ? qty : 0,
      salePrice: Number.isFinite(price) ? price : 0,
      listPrice: Number.isFinite(price) ? price : 0,
      approved: p.status === 1,
      images: [],
    };
  }

  private defaultStockId(credentials: Record<string, string>): string {
    const raw = credentials.stockId?.trim();
    return raw && raw.length > 0 ? raw : '1';
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const storeUrl = credentials.storeUrl?.trim();
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    if (!storeUrl || !username || !password) {
      return;
    }
    const base = this.restBase(storeUrl);
    const stockId = this.defaultStockId(credentials);
    try {
      const token = await this.fetchAdminToken(base, username, password);
      for (const u of updates) {
        const sku = u.barcode.trim();
        if (!sku) {
          continue;
        }
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${base}/products/${encodeURIComponent(sku)}/stockItems/${encodeURIComponent(stockId)}`,
              data: {
                stockItem: {
                  qty: u.quantity,
                  is_in_stock: u.quantity > 0,
                },
              },
              timeout: 15_000,
              ...this.authHeader(token),
            },
            { maxRetries: 2 },
          );
        });
      }
    } catch (error) {
      this.logger.warn('Magento stok güncellemesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const storeUrl = credentials.storeUrl?.trim();
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    if (!storeUrl || !username || !password) {
      return;
    }
    const base = this.restBase(storeUrl);
    try {
      const token = await this.fetchAdminToken(base, username, password);
      for (const u of updates) {
        const sku = u.barcode.trim();
        if (!sku) {
          continue;
        }
        await withRateLimit(this.platform, this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${base}/products/${encodeURIComponent(sku)}`,
              data: {
                product: {
                  sku,
                  price: u.salePrice,
                },
              },
              timeout: 15_000,
              ...this.authHeader(token),
            },
            { maxRetries: 2 },
          );
        });
      }
    } catch (error) {
      this.logger.warn('Magento fiyat güncellemesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  }
}
