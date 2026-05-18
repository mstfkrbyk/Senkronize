import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { WC_API_PATH } from './woocommerce.constants';
import type { WcOrder, WcOrderLineItem, WcProduct } from './woocommerce.types';

@Injectable()
export class WoocommerceAdapter implements IMarketplaceAdapter {
  readonly platform = 'WOOCOMMERCE';
  private readonly logger = new Logger(WoocommerceAdapter.name);

  private normalizeStoreUrl(storeUrl: string): string {
    return storeUrl.replace(/\/+$/, '');
  }

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const key = credentials.consumerKey ?? '';
    const secret = credentials.consumerSecret ?? '';
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const base = `${this.normalizeStoreUrl(credentials.storeUrl ?? '')}${WC_API_PATH}`;
    return axios.create({
      baseURL: base,
      headers: { Authorization: `Basic ${auth}` },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { storeUrl, consumerKey, consumerSecret } = credentials;
      if (!storeUrl || !consumerKey || !consumerSecret) {
        return false;
      }
      await this.getClient(credentials).get('/system_status');
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
    const { storeUrl, consumerKey, consumerSecret } = credentials;
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return [];
    }
    const after = (since ?? new Date(Date.now() - 7 * 86_400_000)).toISOString();
    const client = this.getClient(credentials);
    const { data } = await client.get<WcOrder[]>('/orders', {
      params: {
        after,
        status: 'processing,on-hold',
        per_page: 100,
        page: 1,
      },
    });
    const rows = Array.isArray(data) ? data : [];
    return rows.map((o) => this.mapOrder(o));
  }

  private mapOrder(o: WcOrder): MarketplaceOrder {
    const billing = o.billing;
    const first = billing?.first_name ?? '';
    const last = billing?.last_name ?? '';
    const customerName = `${first} ${last}`.trim() || '—';
    const items = (o.line_items ?? []).map((li: WcOrderLineItem) => {
      const sku = String(li.sku ?? '');
      const idPart = li.id ?? li.product_id ?? '';
      const barcode = sku || String(idPart);
      const qty = Number(li.quantity ?? 0);
      const unit = parseFloat(li.price ?? '0');
      return {
        sku,
        barcode,
        quantity: Number.isFinite(qty) ? qty : 0,
        unitPrice: Number.isFinite(unit) ? unit : 0,
        platformItemId: String(li.id ?? li.product_id ?? barcode),
        productName: li.name,
      };
    });
    const total = parseFloat(o.total ?? '0');
    return {
      platformOrderId: String(o.id),
      status: String(o.status ?? ''),
      customerName,
      items,
      totalAmount: Number.isFinite(total) ? total : 0,
      currency: String(o.currency ?? 'TRY'),
      createdAt: new Date(o.date_created ?? Date.now()).toISOString(),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const { storeUrl, consumerKey, consumerSecret } = credentials;
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const client = this.getClient(credentials);
    const apiPage = page + 1;
    const { data, headers } = await client.get<WcProduct[]>('/products', {
      params: { per_page: 50, page: apiPage, status: 'publish' },
    });
    const rows = Array.isArray(data) ? data : [];
    const total = parseInt(headers['x-wp-total'] ?? String(rows.length), 10);
    return {
      items: rows.map((p) => this.mapProduct(p)),
      total: Number.isFinite(total) ? total : rows.length,
      page,
      pageSize: 50,
    };
  }

  private mapProduct(p: WcProduct): MarketplaceListing {
    const sku = p.sku ?? String(p.id);
    const sale = parseFloat(p.price ?? '0');
    const list = parseFloat(p.regular_price ?? p.price ?? '0');
    const qty = p.stock_quantity ?? 0;
    const images = (p.images ?? [])
      .map((im) => im.src)
      .filter((src): src is string => typeof src === 'string' && src.length > 0);
    return {
      platformProductId: String(p.id),
      barcode: sku,
      title: String(p.name ?? sku),
      quantity: typeof qty === 'number' && Number.isFinite(qty) ? qty : 0,
      salePrice: Number.isFinite(sale) ? sale : 0,
      listPrice: Number.isFinite(list) ? list : sale,
      approved: p.status === 'publish',
      images,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const { storeUrl, consumerKey, consumerSecret } = credentials;
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return;
    }
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        const { data } = await client.get<WcProduct[]>('/products', {
          params: { sku: u.barcode },
        });
        const row = Array.isArray(data) ? data[0] : undefined;
        if (row?.id) {
          await client.put(`/products/${row.id}`, {
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
    const { storeUrl, consumerKey, consumerSecret } = credentials;
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return;
    }
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        const { data } = await client.get<WcProduct[]>('/products', {
          params: { sku: u.barcode },
        });
        const row = Array.isArray(data) ? data[0] : undefined;
        if (row?.id) {
          await client.put(`/products/${row.id}`, {
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
}
