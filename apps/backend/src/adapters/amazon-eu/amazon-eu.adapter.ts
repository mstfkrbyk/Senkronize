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
  AMAZON_SP_AWS_REGION_EU,
  AMAZON_SP_EU_BASE_URL,
} from '../amazon/amazon.constants';
import {
  amazonCreateSpClient,
  amazonGetLwaToken,
  amazonGetListingsForMarketplace,
  amazonGetOrdersForMarketplace,
  amazonUpdatePriceForMarketplace,
  amazonUpdateStockForMarketplace,
} from '../amazon/amazon-sp-api.shared';
import {
  AMAZON_EU_MARKETPLACE_CURRENCY,
  AMAZON_EU_MARKETPLACE_ID_SET,
  AMAZON_EU_MARKETPLACE_IDS,
} from './amazon-eu.constants';

@Injectable()
export class AmazonEuAdapter implements IMarketplaceAdapter {
  readonly platform = 'AMAZON_EU';
  private readonly logger = new Logger(AmazonEuAdapter.name);
  private readonly spBaseUrl = AMAZON_SP_EU_BASE_URL;
  private readonly awsRegion = AMAZON_SP_AWS_REGION_EU;

  private async createClient(credentials: Record<string, string>) {
    const token = await amazonGetLwaToken(credentials, this.spBaseUrl, this.awsRegion);
    return amazonCreateSpClient(
      credentials,
      token,
      this.spBaseUrl,
      this.awsRegion,
    );
  }

  private resolveEuMarketplaceId(credentials: Record<string, string>): string {
    const id = credentials.marketplaceId?.trim() ?? '';
    if (!id) {
      throw new Error(
        `Amazon EU: marketplaceId zorunludur (ör. DE=${AMAZON_EU_MARKETPLACE_IDS.DE})`,
      );
    }
    if (!AMAZON_EU_MARKETPLACE_ID_SET.has(id)) {
      throw new Error(
        'Amazon EU: marketplaceId DE/FR/UK/IT/ES SP-API kimliklerinden biri olmalıdır',
      );
    }
    return id;
  }

  private resolveCurrency(marketplaceId: string, credentials: Record<string, string>): string {
    const override = credentials.currency?.trim().toUpperCase();
    if (override && override.length === 3) {
      return override;
    }
    return AMAZON_EU_MARKETPLACE_CURRENCY[marketplaceId] ?? 'EUR';
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { clientId, clientSecret, refreshToken, sellerId } = credentials;
      if (!clientId || !clientSecret || !refreshToken || !sellerId) {
        return false;
      }
      this.resolveEuMarketplaceId(credentials);
      const token = await amazonGetLwaToken(credentials, this.spBaseUrl, this.awsRegion);
      const client = amazonCreateSpClient(
        credentials,
        token,
        this.spBaseUrl,
        this.awsRegion,
      );
      await client.get('/sellers/v1/marketplaceParticipations');
      return true;
    } catch (error) {
      this.logger.warn('Amazon EU bağlantı testi başarısız', {
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
    const marketplaceId = this.resolveEuMarketplaceId(credentials);
    const currency = this.resolveCurrency(marketplaceId, credentials);
    return await amazonGetOrdersForMarketplace(
      client,
      marketplaceId,
      currency,
      since,
    );
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const client = await this.createClient(credentials);
    const sellerId = credentials.sellerId;
    const marketplaceId = this.resolveEuMarketplaceId(credentials);
    return await amazonGetListingsForMarketplace(client, sellerId, marketplaceId, page);
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = await this.createClient(credentials);
    const sellerId = credentials.sellerId;
    const marketplaceId = this.resolveEuMarketplaceId(credentials);
    await amazonUpdateStockForMarketplace(
      client,
      sellerId,
      marketplaceId,
      updates,
      (sku, message) => {
        this.logger.warn('Amazon EU stok güncellemesi başarısız', { sku, error: message });
      },
    );
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const client = await this.createClient(credentials);
    const sellerId = credentials.sellerId;
    const marketplaceId = this.resolveEuMarketplaceId(credentials);
    const currency = this.resolveCurrency(marketplaceId, credentials);
    await amazonUpdatePriceForMarketplace(
      client,
      sellerId,
      marketplaceId,
      currency,
      updates,
      (sku, message) => {
        this.logger.warn('Amazon EU fiyat güncellemesi başarısız', {
          sku,
          error: message,
        });
      },
    );
  }
}
