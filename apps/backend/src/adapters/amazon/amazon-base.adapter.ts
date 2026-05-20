import { Logger } from '@nestjs/common';
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
} from './amazon-sp-api.shared';

export interface AmazonRegionalConfig {
  platform: string;
  spBaseUrl: string;
  marketplaceId: string;
  defaultCurrency: string;
  loggerContext: string;
}

/** Amazon SP-API OAuth bölgesel pazaryeri adaptörleri için ortak taban */
export class AmazonBaseAdapter implements IMarketplaceAdapter {
  readonly platform: string;
  private readonly config: AmazonRegionalConfig;
  private readonly logger: Logger;

  constructor(config: AmazonRegionalConfig) {
    this.config = config;
    this.platform = config.platform;
    this.logger = new Logger(config.loggerContext);
  }

  private resolveMarketplaceId(credentials: Record<string, string>): string {
    return amazonResolveMarketplaceId(credentials, this.config.marketplaceId);
  }

  private resolveCurrency(credentials: Record<string, string>): string {
    const override = credentials.currency?.trim().toUpperCase();
    if (override && override.length === 3) {
      return override;
    }
    return this.config.defaultCurrency;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { clientId, clientSecret, refreshToken, sellerId } = credentials;
      if (!clientId || !clientSecret || !refreshToken || !sellerId) {
        return false;
      }
      const token = await amazonGetLwaToken(credentials);
      const client = amazonCreateSpClient(credentials, token, this.config.spBaseUrl);
      await client.get('/sellers/v1/marketplaceParticipations');
      return true;
    } catch (error) {
      this.logger.warn(`${this.config.platform} bağlantı testi başarısız`, {
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
    const client = amazonCreateSpClient(credentials, token, this.config.spBaseUrl);
    const marketplaceId = this.resolveMarketplaceId(credentials);
    const currency = this.resolveCurrency(credentials);
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
    const token = await amazonGetLwaToken(credentials);
    const client = amazonCreateSpClient(credentials, token, this.config.spBaseUrl);
    const sellerId = credentials.sellerId;
    const marketplaceId = this.resolveMarketplaceId(credentials);
    return await amazonGetListingsForMarketplace(
      client,
      sellerId,
      marketplaceId,
      page,
    );
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const token = await amazonGetLwaToken(credentials);
    const client = amazonCreateSpClient(credentials, token, this.config.spBaseUrl);
    const sellerId = credentials.sellerId;
    const marketplaceId = this.resolveMarketplaceId(credentials);
    await amazonUpdateStockForMarketplace(
      client,
      sellerId,
      marketplaceId,
      updates,
      (sku, message) => {
        this.logger.warn(`${this.config.platform} stok güncellemesi başarısız`, {
          sku,
          error: message,
        });
      },
    );
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const token = await amazonGetLwaToken(credentials);
    const client = amazonCreateSpClient(credentials, token, this.config.spBaseUrl);
    const sellerId = credentials.sellerId;
    const marketplaceId = this.resolveMarketplaceId(credentials);
    const currency = this.resolveCurrency(credentials);
    await amazonUpdatePriceForMarketplace(
      client,
      sellerId,
      marketplaceId,
      currency,
      updates,
      (sku, message) => {
        this.logger.warn(`${this.config.platform} fiyat güncellemesi başarısız`, {
          sku,
          error: message,
        });
      },
    );
  }
}
