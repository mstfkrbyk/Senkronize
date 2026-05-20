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

import { shopifyBaseUrl } from './shopify.constants';
import type {
  ShopifyLineItem,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyVariant,
  ShopifyWebhook,
} from './shopify.types';

export interface ShopifyFulfillmentInput {
  trackingNumber?: string;
  trackingCompany?: string;
  notifyCustomer?: boolean;
}

@Injectable()
export class ShopifyAdapter implements IMarketplaceAdapter {
  readonly platform = 'SHOPIFY';
  private readonly logger = new Logger(ShopifyAdapter.name);

  private hasCredentials(credentials: Record<string, string>): boolean {
    return Boolean(
      credentials.shopDomain?.trim() && credentials.accessToken?.trim(),
    );
  }

  getClient(credentials: Record<string, string>): AxiosInstance {
    const shop = credentials.shopDomain ?? '';
    return axios.create({
      baseURL: shopifyBaseUrl(shop),
      headers: {
        'X-Shopify-Access-Token': credentials.accessToken ?? '',
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      if (!this.hasCredentials(credentials)) {
        return false;
      }
      await this.getClient(credentials).get('/shop.json');
      return true;
    } catch (error) {
      this.logger.warn('Shopify bağlantı testi başarısız', {
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
    const created_at_min = (since ?? new Date(Date.now() - 7 * 86_400_000)).toISOString();
    const client = this.getClient(credentials);
    const { data } = await client.get<{ orders?: ShopifyOrder[] }>('/orders.json', {
      params: { status: 'open', created_at_min, limit: 250 },
    });
    const rows = data.orders ?? [];
    return rows.map((o) => this.mapOrder(o));
  }

  /** Shopify sipariş güncelle (PUT /orders/{id}.json) */
  async updateOrder(
    credentials: Record<string, string>,
    platformOrderId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    if (!this.hasCredentials(credentials)) {
      return;
    }
    const client = this.getClient(credentials);
    await client.put(`/orders/${platformOrderId}.json`, {
      order: { id: Number(platformOrderId), ...patch },
    });
  }

  /**
   * Kargo bildirimi — POST /orders/{orderId}/fulfillments.json
   */
  async createFulfillment(
    credentials: Record<string, string>,
    platformOrderId: string,
    input: ShopifyFulfillmentInput = {},
  ): Promise<void> {
    if (!this.hasCredentials(credentials)) {
      return;
    }
    const client = this.getClient(credentials);
    const { data: orderData } = await client.get<{ order?: ShopifyOrder }>(
      `/orders/${platformOrderId}.json`,
    );
    const lineItems = (orderData.order?.line_items ?? [])
      .map((li: ShopifyLineItem) => li.id)
      .filter((id): id is number => typeof id === 'number');
    if (lineItems.length === 0) {
      return;
    }
    await client.post(`/orders/${platformOrderId}/fulfillments.json`, {
      fulfillment: {
        notify_customer: input.notifyCustomer ?? true,
        tracking_number: input.trackingNumber,
        tracking_company: input.trackingCompany,
        line_items: lineItems.map((id) => ({ id })),
      },
    });
  }

  private mapOrder(o: ShopifyOrder): MarketplaceOrder {
    const c = o.customer;
    const first = c?.first_name ?? '';
    const last = c?.last_name ?? '';
    const customerName = `${first} ${last}`.trim() || '—';
    const buyerEmail = c?.email ?? o.email ?? '';
    const customerWithEmail =
      buyerEmail && customerName === '—' ? buyerEmail : customerName;
    const items = (o.line_items ?? []).map((li: ShopifyLineItem) => {
      const sku = String(li.sku ?? '');
      const idPart = li.id ?? '';
      const barcode = sku || String(idPart);
      const qty = Number(li.quantity ?? 0);
      const unit = parseFloat(li.price ?? '0');
      return {
        sku,
        barcode,
        quantity: Number.isFinite(qty) ? qty : 0,
        unitPrice: Number.isFinite(unit) ? unit : 0,
        platformItemId: String(li.id ?? barcode),
        productName: li.title,
      };
    });
    const total = parseFloat(o.total_price ?? '0');
    return {
      platformOrderId: String(o.id),
      status: String(o.financial_status ?? o.fulfillment_status ?? ''),
      customerName: customerWithEmail,
      items,
      totalAmount: Number.isFinite(total) ? total : 0,
      currency: String(o.currency ?? 'TRY'),
      createdAt: new Date(o.created_at ?? Date.now()).toISOString(),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    if (!this.hasCredentials(credentials)) {
      return { items: [], total: 0, page: 0, pageSize: 250 };
    }
    if (page > 0) {
      return { items: [], total: 0, page, pageSize: 250 };
    }
    const client = this.getClient(credentials);
    const allProducts: ShopifyProduct[] = [];
    let sinceId: number | undefined;
    for (;;) {
      const { data } = await client.get<{ products?: ShopifyProduct[] }>(
        '/products.json',
        {
          params: {
            limit: 250,
            ...(sinceId !== undefined ? { since_id: sinceId } : {}),
          },
        },
      );
      const batch = data.products ?? [];
      if (batch.length === 0) {
        break;
      }
      allProducts.push(...batch);
      sinceId = batch[batch.length - 1]?.id;
      if (batch.length < 250) {
        break;
      }
    }
    const items = allProducts.map((p) => this.mapProduct(p));
    const pageSize = Math.max(items.length, 1);
    return {
      items,
      total: items.length,
      page: 0,
      pageSize,
    };
  }

  private mapProduct(p: ShopifyProduct): MarketplaceListing {
    const v0: ShopifyVariant | undefined = p.variants?.[0];
    const sku = String(v0?.sku ?? p.id);
    const price = parseFloat(v0?.price ?? '0');
    const compare = parseFloat(v0?.compare_at_price ?? v0?.price ?? '0');
    const qty = v0?.inventory_quantity ?? 0;
    const images = (p.images ?? [])
      .map((im) => im.src)
      .filter((src): src is string => typeof src === 'string' && src.length > 0);
    return {
      platformProductId: String(p.id),
      barcode: sku,
      title: String(p.title ?? sku),
      quantity: typeof qty === 'number' && Number.isFinite(qty) ? qty : 0,
      salePrice: Number.isFinite(price) ? price : 0,
      listPrice: Number.isFinite(compare) ? compare : price,
      approved: p.status === 'active',
      images,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    if (!this.hasCredentials(credentials) || updates.length === 0) {
      return;
    }
    const client = this.getClient(credentials);
    let locationId: number | undefined;
    try {
      const { data: locData } = await client.get<{ locations?: { id: number }[] }>(
        '/locations.json',
      );
      locationId = locData.locations?.[0]?.id;
    } catch (error) {
      this.logger.warn('Shopify lokasyonları alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return;
    }
    if (locationId === undefined) {
      return;
    }
    const bySku = await this.buildVariantSkuIndex(client);
    for (const u of updates) {
      try {
        const variant = bySku.get(u.barcode);
        if (variant?.inventory_item_id) {
          await client.post('/inventory_levels/set.json', {
            location_id: locationId,
            inventory_item_id: variant.inventory_item_id,
            available: u.quantity,
          });
        }
      } catch (error) {
        this.logger.warn('Shopify stok güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  private async buildVariantSkuIndex(
    client: AxiosInstance,
  ): Promise<Map<string, ShopifyVariant & { id: number }>> {
    const map = new Map<string, ShopifyVariant & { id: number }>();
    let sinceId: number | undefined;
    for (;;) {
      const { data } = await client.get<{ products?: ShopifyProduct[] }>(
        '/products.json',
        {
          params: {
            limit: 250,
            ...(sinceId !== undefined ? { since_id: sinceId } : {}),
          },
        },
      );
      const products = data.products ?? [];
      if (products.length === 0) {
        break;
      }
      for (const p of products) {
        for (const v of p.variants ?? []) {
          const sku = v.sku?.trim();
          if (sku && v.id !== undefined && v.inventory_item_id != null) {
            map.set(sku, { ...v, id: v.id });
          }
        }
      }
      sinceId = products[products.length - 1]?.id;
      if (products.length < 250) {
        break;
      }
    }
    return map;
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    if (!this.hasCredentials(credentials)) {
      return;
    }
    const client = this.getClient(credentials);
    const bySku = await this.buildVariantSkuIndex(client);
    for (const u of updates) {
      try {
        const variant = bySku.get(u.barcode);
        const variantId = variant?.id;
        if (variantId === undefined) {
          continue;
        }
        await client.put(`/variants/${variantId}.json`, {
          variant: {
            id: variantId,
            price: String(u.salePrice),
            ...(u.listPrice > u.salePrice
              ? { compare_at_price: String(u.listPrice) }
              : { compare_at_price: null }),
          },
        });
      } catch (error) {
        this.logger.warn('Shopify fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  /**
   * Shopify Admin API üzerinde orders/create ve orders/updated webhook kaydı.
   */
  async registerInboundWebhooks(
    credentials: Record<string, string>,
    address: string,
  ): Promise<void> {
    if (!this.hasCredentials(credentials)) {
      throw new Error('Shopify kimlik bilgileri eksik');
    }
    const client = this.getClient(credentials);
    const topics = ['orders/create', 'orders/updated'] as const;
    for (const topic of topics) {
      try {
        await client.post<{ webhook?: ShopifyWebhook }>('/webhooks.json', {
          webhook: { topic, address, format: 'json' },
        });
      } catch (error) {
        this.logger.warn('Shopify webhook kaydı başarısız', {
          topic,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
