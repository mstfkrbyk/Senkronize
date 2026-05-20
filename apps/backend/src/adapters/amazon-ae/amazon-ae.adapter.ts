import { Injectable, Logger } from '@nestjs/common';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  amazonCreateSpClient,
  amazonGetLwaToken,
  amazonGetListingsForMarketplace,
  amazonGetOrdersForMarketplace,
  amazonResolveMarketplaceId,
  amazonUpdatePriceForMarketplace,
  amazonUpdateStockForMarketplace,
} from '../amazon/amazon-sp-api.shared';
import {
  AMAZON_AE_DEFAULT_CURRENCY,
  AMAZON_AE_MARKETPLACE_ID,
} from './amazon-ae.constants';

@Injectable()
export class AmazonAeAdapter implements IMarketplaceAdapter {
  readonly platform = 'AMAZON_AE';
  private readonly logger = new Logger(AmazonAeAdapter.name);

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { clientId, clientSecret, refreshToken, sellerId } = credentials;
      if (!clientId || !clientSecret || !refreshToken || !sellerId) {
        return false;
      }
      const token = await amazonGetLwaToken(credentials);
      const client = amazonCreateSpClient(credentials, token);
      await client.get('/sellers/v1/marketplaceParticipations');
      return true;
    } catch (error) {
      this.logger.warn('Amazon AE bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const token = await amazonGetLwaToken(credentials);
    const client = amazonCreateSpClient(credentials, token);
    const marketplaceId = amazonResolveMarketplaceId(
      credentials,
      AMAZON_AE_MARKETPLACE_ID,
    );
    return await amazonGetOrdersForMarketplace(
      client,
      marketplaceId,
      AMAZON_AE_DEFAULT_CURRENCY,
      since,
    );
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const token = await amazonGetLwaToken(credentials);
    const client = amazonCreateSpClient(credentials, token);
    const sellerId = credentials.sellerId;
    const marketplaceId = amazonResolveMarketplaceId(
      credentials,
      AMAZON_AE_MARKETPLACE_ID,
    );
    return await amazonGetListingsForMarketplace(client, sellerId, marketplaceId, page);
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const token = await amazonGetLwaToken(credentials);
    const client = amazonCreateSpClient(credentials, token);
    const sellerId = credentials.sellerId;
    const marketplaceId = amazonResolveMarketplaceId(
      credentials,
      AMAZON_AE_MARKETPLACE_ID,
    );
    await amazonUpdateStockForMarketplace(
      client,
      sellerId,
      marketplaceId,
      updates,
      (sku, message) => {
        this.logger.warn('Amazon AE stok güncellemesi başarısız', { sku, error: message });
      },
    );
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const token = await amazonGetLwaToken(credentials);
    const client = amazonCreateSpClient(credentials, token);
    const sellerId = credentials.sellerId;
    const marketplaceId = amazonResolveMarketplaceId(
      credentials,
      AMAZON_AE_MARKETPLACE_ID,
    );
    await amazonUpdatePriceForMarketplace(
      client,
      sellerId,
      marketplaceId,
      AMAZON_AE_DEFAULT_CURRENCY,
      updates,
      (sku, message) => {
        this.logger.warn('Amazon AE fiyat güncellemesi başarısız', { sku, error: message });
      },
    );
  }
}
