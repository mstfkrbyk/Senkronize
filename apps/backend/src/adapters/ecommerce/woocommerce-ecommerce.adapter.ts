import { Injectable, Logger } from '@nestjs/common';
import type {
  IEcommerceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import type { NormalizedOrder } from '../common/order-normalizer';
import { WoocommerceAdapter } from '../woocommerce/woocommerce.adapter';
import { WC_PRODUCTS_PER_PAGE } from '../woocommerce/woocommerce.constants';

@Injectable()
export class WoocommerceEcommerceAdapter implements IEcommerceAdapter {
  readonly platform = 'WOOCOMMERCE';
  private readonly logger = new Logger(WoocommerceEcommerceAdapter.name);

  constructor(private readonly wc: WoocommerceAdapter) {}

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    return this.wc.getOrders(credentials, since);
  }

  async fetchProducts(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<MarketplaceListing[]> {
    const result = await this.wc.getListings(credentials, page);
    return result.items;
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    await this.wc.updateStock(credentials, updates);
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    await this.wc.updatePrice(credentials, updates);
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    return this.wc.testConnection(credentials);
  }

  async getOrderById(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<NormalizedOrder | null> {
    return this.wc.getOrderById(credentials, orderId);
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
    try {
      return await this.wc.getListings(credentials, page);
    } catch (error) {
      this.logger.warn('WooCommerce ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize: WC_PRODUCTS_PER_PAGE };
    }
  }
}
