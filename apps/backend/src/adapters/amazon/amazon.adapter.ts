import { Injectable, Logger } from '@nestjs/common';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { AMAZON_TR_MARKETPLACE_ID } from './amazon.constants';
import {
  amazonCreateSpClient,
  amazonGetLwaToken,
  amazonGetListingsForMarketplace,
  amazonGetOrdersForMarketplace,
  amazonResolveMarketplaceId,
  amazonUpdatePriceForMarketplace,
  amazonUpdateStockForMarketplace,
} from './amazon-sp-api.shared';

@Injectable()
export class AmazonAdapter implements IMarketplaceAdapter {
  readonly platform = 'AMAZON_TR';
  private readonly logger = new Logger(AmazonAdapter.name);

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { refreshToken, sellerId, accessKeyId, secretAccessKey } = credentials;
      if (!refreshToken || !sellerId || !accessKeyId || !secretAccessKey) {
        return false;
      }
      const token = await amazonGetLwaToken(credentials);
      const client = amazonCreateSpClient(credentials, token);
      await client.get('/sellers/v1/marketplaceParticipations');
      return true;
    } catch (error) {
      this.logger.warn('Amazon bağlantı testi başarısız', {
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
      AMAZON_TR_MARKETPLACE_ID,
    );
    return await amazonGetOrdersForMarketplace(
      client,
      marketplaceId,
      'TRY',
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
      AMAZON_TR_MARKETPLACE_ID,
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
      AMAZON_TR_MARKETPLACE_ID,
    );
    await amazonUpdateStockForMarketplace(
      client,
      sellerId,
      marketplaceId,
      updates,
      (sku, message) => {
        this.logger.warn('Amazon stok güncellemesi başarısız', { sku, error: message });
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
      AMAZON_TR_MARKETPLACE_ID,
    );
    await amazonUpdatePriceForMarketplace(
      client,
      sellerId,
      marketplaceId,
      'TRY',
      updates,
      (sku, message) => {
        this.logger.warn('Amazon fiyat güncellemesi başarısız', { sku, error: message });
      },
    );
  }
}
