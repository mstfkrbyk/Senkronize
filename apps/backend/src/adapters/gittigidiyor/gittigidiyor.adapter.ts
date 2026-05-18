import { Injectable } from '@nestjs/common';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { EbayAdapter } from '../ebay/ebay.adapter';

/**
 * GittiGidiyor arşiv: eBay OpenAPI ile aynı uçlar; yalnızca sipariş ve ürün okuma.
 * Stok/fiyat güncellemesi desteklenmez (platform kapalı).
 */
@Injectable()
export class GittigidiyorAdapter implements IMarketplaceAdapter {
  readonly platform = 'GITTIGIDIYOR';

  constructor(private readonly ebay: EbayAdapter) {}

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    return this.ebay.testConnection(credentials);
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    return this.ebay.getOrders(credentials, since);
  }

  async getListings(
    credentials: Record<string, string>,
    page?: number,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    return this.ebay.getListings(credentials, page);
  }

  async updateStock(
    _credentials: Record<string, string>,
    _updates: StockUpdatePayload[],
  ): Promise<void> {
    return;
  }

  async updatePrice(
    _credentials: Record<string, string>,
    _updates: PriceUpdatePayload[],
  ): Promise<void> {
    return;
  }
}
