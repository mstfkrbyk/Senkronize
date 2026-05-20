import { Logger } from '@nestjs/common';
import type { AxiosRequestConfig } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  MarketplaceReturn,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';

export interface GraphqlStubMarketplaceOptions {
  platform: string;
  loggerContext: string;
  rateLimitKey: string;
  resolveGraphqlUrl: (credentials: Record<string, string>) => string;
  resolveAuth: (
    credentials: Record<string, string>,
  ) => Promise<Pick<AxiosRequestConfig, 'headers'>>;
  testQuery?: string;
}

interface GraphqlEnvelope<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

/**
 * GraphQL tabanlı headless e-ticaret adaptörleri için ortak stub.
 */
export class GraphqlStubMarketplaceAdapter implements IMarketplaceAdapter {
  readonly platform: string;
  private readonly logger: Logger;
  private readonly opts: GraphqlStubMarketplaceOptions;

  constructor(
    encryptionService: EncryptionService,
    opts: GraphqlStubMarketplaceOptions,
  ) {
    void encryptionService;
    this.opts = opts;
    this.platform = opts.platform;
    this.logger = new Logger(opts.loggerContext);
  }

  private rpm(): number {
    return (
      PLATFORM_RATE_LIMITS[this.opts.rateLimitKey] ??
      PLATFORM_RATE_LIMITS.DEFAULT
    );
  }

  private async postGql<T>(
    credentials: Record<string, string>,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const url = this.opts.resolveGraphqlUrl(credentials).trim();
    const auth = await this.opts.resolveAuth(credentials);
    const res = await axiosWithRetry<GraphqlEnvelope<T>>(
      {
        method: 'POST',
        url,
        data: { query, variables },
        timeout: 20_000,
        headers: {
          'Content-Type': 'application/json',
          ...auth.headers,
        },
      },
      { maxRetries: 1 },
    );
    if (Array.isArray(res.errors) && res.errors.length > 0) {
      const msg = res.errors.map((e) => e.message).join('; ');
      throw new Error(`${this.opts.platform} GraphQL: ${msg}`);
    }
    if (res.data === undefined) {
      throw new Error(`${this.opts.platform} GraphQL: boş yanıt`);
    }
    return res.data;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const query = this.opts.testQuery ?? 'query { __typename }';
      await withRateLimit(this.opts.rateLimitKey, this.rpm(), async () => {
        await this.postGql(credentials, query);
      });
      return true;
    } catch (error) {
      this.logger.warn(`${this.opts.platform} bağlantı testi başarısız`, {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<MarketplaceOrder[]> {
    return [];
  }

  async getListings(
    _credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    return { items: [], total: 0, page, pageSize: 50 };
  }

  async getReturns(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<MarketplaceReturn[]> {
    return [];
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
