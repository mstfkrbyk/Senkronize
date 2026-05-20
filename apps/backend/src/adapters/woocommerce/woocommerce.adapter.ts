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

import {
  WC_API_PATH,
  WC_ORDER_STATUSES,
  WC_ORDERS_PER_PAGE,
  WC_PRODUCTS_PER_PAGE,
} from './woocommerce.constants';
import type {
  WcOrder,
  WcOrderLineItem,
  WcProduct,
  WcVariation,
  WcWebhook,
} from './woocommerce.types';

@Injectable()
export class WoocommerceAdapter implements IMarketplaceAdapter {
  readonly platform = 'WOOCOMMERCE';
  private readonly logger = new Logger(WoocommerceAdapter.name);

  private normalizeStoreUrl(storeUrl: string): string {
    return storeUrl.replace(/\/+$/, '');
  }

  private hasCredentials(credentials: Record<string, string>): boolean {
    const storeUrl = credentials.storeUrl?.trim();
    const consumerKey = credentials.consumerKey?.trim();
    const consumerSecret = credentials.consumerSecret?.trim();
    return Boolean(storeUrl && consumerKey && consumerSecret);
  }

  getClient(credentials: Record<string, string>): AxiosInstance {
    const key = credentials.consumerKey ?? '';
    const secret = credentials.consumerSecret ?? '';
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const base = `${this.normalizeStoreUrl(credentials.storeUrl ?? '')}${WC_API_PATH}`;
    return axios.create({
      baseURL: base,
      headers: { Authorization: `Basic ${auth}` },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      if (!this.hasCredentials(credentials)) {
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
    if (!this.hasCredentials(credentials)) {
      return [];
    }
    const after = (since ?? new Date(Date.now() - 7 * 86_400_000)).toISOString();
    const client = this.getClient(credentials);
    const all: WcOrder[] = [];
    let page = 1;
    for (;;) {
      const { data } = await client.get<WcOrder[]>('/orders', {
        params: {
          after,
          status: WC_ORDER_STATUSES,
          per_page: WC_ORDERS_PER_PAGE,
          page,
        },
      });
      const rows = Array.isArray(data) ? data : [];
      all.push(...rows);
      if (rows.length < WC_ORDERS_PER_PAGE) {
        break;
      }
      page += 1;
    }
    return all.map((o) => this.mapOrder(o));
  }

  /** WooCommerce sipariş durumu güncelle (PUT /orders/{id}) */
  async updateOrderStatus(
    credentials: Record<string, string>,
    platformOrderId: string,
    status: string,
  ): Promise<void> {
    if (!this.hasCredentials(credentials)) {
      return;
    }
    const client = this.getClient(credentials);
    await client.put(`/orders/${platformOrderId}`, { status });
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
    if (!this.hasCredentials(credentials)) {
      return { items: [], total: 0, page: 0, pageSize: WC_PRODUCTS_PER_PAGE };
    }
    const client = this.getClient(credentials);
    const apiPage = page + 1;
    const { data, headers } = await client.get<WcProduct[]>('/products', {
      params: { per_page: WC_PRODUCTS_PER_PAGE, page: apiPage, status: 'publish' },
    });
    const rows = Array.isArray(data) ? data : [];
    const total = parseInt(headers['x-wp-total'] ?? String(rows.length), 10);
    return {
      items: rows.map((p) => this.mapProduct(p)),
      total: Number.isFinite(total) ? total : rows.length,
      page,
      pageSize: WC_PRODUCTS_PER_PAGE,
    };
  }

  private mapProduct(p: WcProduct): MarketplaceListing {
    const sku = p.sku ?? String(p.id);
    const sale = parseFloat(p.sale_price ?? p.price ?? '0');
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
    if (!this.hasCredentials(credentials)) {
      return;
    }
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        const target = await this.resolveProductTarget(client, u.barcode);
        if (!target) {
          continue;
        }
        if (target.kind === 'product') {
          await client.put(`/products/${target.id}`, {
            stock_quantity: u.quantity,
            manage_stock: true,
          });
        } else {
          await client.put(
            `/products/${target.productId}/variations/${target.id}`,
            { stock_quantity: u.quantity, manage_stock: true },
          );
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
    if (!this.hasCredentials(credentials)) {
      return;
    }
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        const target = await this.resolveProductTarget(client, u.barcode);
        if (!target) {
          continue;
        }
        const body = {
          regular_price: String(u.listPrice),
          sale_price: String(u.salePrice),
        };
        if (target.kind === 'product') {
          await client.put(`/products/${target.id}`, body);
        } else {
          await client.put(
            `/products/${target.productId}/variations/${target.id}`,
            body,
          );
        }
      } catch (error) {
        this.logger.warn('WooCommerce fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  private async resolveProductTarget(
    client: AxiosInstance,
    barcode: string,
  ): Promise<
    | { kind: 'product'; id: number }
    | { kind: 'variation'; id: number; productId: number }
    | null
  > {
    const { data } = await client.get<WcProduct[]>('/products', {
      params: { sku: barcode, per_page: 20 },
    });
    const products = Array.isArray(data) ? data : [];
    const direct = products.find((p) => p.sku === barcode);
    if (direct?.id) {
      return { kind: 'product', id: direct.id };
    }
    for (const p of products) {
      if (!p.id) {
        continue;
      }
      const { data: vars } = await client.get<WcVariation[]>(
        `/products/${p.id}/variations`,
        { params: { per_page: 100 } },
      );
      const rows = Array.isArray(vars) ? vars : [];
      const match = rows.find((v) => v.sku === barcode);
      if (match?.id) {
        return { kind: 'variation', id: match.id, productId: p.id };
      }
    }
    const fallback = products[0];
    if (fallback?.id) {
      return { kind: 'product', id: fallback.id };
    }
    return null;
  }

  /**
   * WooCommerce mağazasında gelen webhook uçlarını kaydeder.
   * @see https://woocommerce.github.io/woocommerce-rest-api-docs/#webhooks
   */
  async registerInboundWebhooks(
    credentials: Record<string, string>,
    deliveryUrl: string,
    secret: string,
  ): Promise<void> {
    if (!this.hasCredentials(credentials)) {
      throw new Error('WooCommerce kimlik bilgileri eksik');
    }
    const client = this.getClient(credentials);
    const topics = [
      { topic: 'order.created', name: 'Senkronize Sipariş Oluştu' },
      { topic: 'order.updated', name: 'Senkronize Sipariş Güncellendi' },
    ] as const;
    for (const { topic, name } of topics) {
      try {
        await client.post<WcWebhook>('/webhooks', {
          name,
          status: 'active',
          topic,
          delivery_url: deliveryUrl,
          secret,
        });
      } catch (error) {
        this.logger.warn('WooCommerce webhook kaydı başarısız', {
          topic,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
