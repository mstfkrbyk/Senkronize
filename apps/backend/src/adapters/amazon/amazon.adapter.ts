import { Injectable, Logger } from '@nestjs/common';
import type { AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  AMAZON_MARKETPLACE_CONFIG,
  AMAZON_TR_MARKETPLACE_ID,
} from './amazon.constants';
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
  private readonly trConfig = AMAZON_MARKETPLACE_CONFIG.TR;

  private async createClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const token = await amazonGetLwaToken(
      credentials,
      this.trConfig.spBaseUrl,
      this.trConfig.awsRegion,
    );
    return amazonCreateSpClient(
      credentials,
      token,
      this.trConfig.spBaseUrl,
      this.trConfig.awsRegion,
    );
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { refreshToken, sellerId, accessKeyId, secretAccessKey } = credentials;
      if (!refreshToken || !sellerId || !accessKeyId || !secretAccessKey) {
        return false;
      }
      const client = await this.createClient(credentials);
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
    const client = await this.createClient(credentials);
    const marketplaceId = amazonResolveMarketplaceId(
      credentials,
      AMAZON_TR_MARKETPLACE_ID,
    );
    return await amazonGetOrdersForMarketplace(
      client,
      marketplaceId,
      this.trConfig.defaultCurrency,
      since,
    );
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const client = await this.createClient(credentials);
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
    const client = await this.createClient(credentials);
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
    const client = await this.createClient(credentials);
    const sellerId = credentials.sellerId;
    const marketplaceId = amazonResolveMarketplaceId(
      credentials,
      AMAZON_TR_MARKETPLACE_ID,
    );
    await amazonUpdatePriceForMarketplace(
      client,
      sellerId,
      marketplaceId,
      this.trConfig.defaultCurrency,
      updates,
      (sku, message) => {
        this.logger.warn('Amazon fiyat güncellemesi başarısız', { sku, error: message });
      },
    );
  }
}
