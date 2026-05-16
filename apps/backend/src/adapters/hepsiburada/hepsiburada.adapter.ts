import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

@Injectable()
export class HepsiburadaAdapter implements IMarketplaceAdapter {
  readonly platform = 'HEPSIBURADA';

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    void credentials;
    return true;
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    void credentials;
    void since;
    throw new NotImplementedException(
      'Hepsiburada sipariş çekme henüz uygulanmadı',
    );
  }

  async getListings(
    credentials: Record<string, string>,
    page?: number,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    void credentials;
    void page;
    throw new NotImplementedException(
      'Hepsiburada listeleme henüz uygulanmadı',
    );
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    void credentials;
    void updates;
    throw new NotImplementedException(
      'Hepsiburada stok güncelleme henüz uygulanmadı',
    );
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    void credentials;
    void updates;
    throw new NotImplementedException(
      'Hepsiburada fiyat güncelleme henüz uygulanmadı',
    );
  }
}
