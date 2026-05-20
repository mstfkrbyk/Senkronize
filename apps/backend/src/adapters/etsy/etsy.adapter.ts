import { Injectable, Logger } from '@nestjs/common';
import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
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
import {
  isRecord,
  normalizeProductRows,
  throwSyncFailed,
} from '../stub-helpers';
import type {
  EtsyListing,
  EtsyReceipt,
  EtsyReceiptsResponse,
  EtsyTransaction,
} from './etsy.types';

const ETSY_BASE = 'https://openapi.etsy.com/v3/application';
const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';

@Injectable()
export class EtsyAdapter implements IMarketplaceAdapter {
  readonly platform = 'ETSY';
  private readonly logger = new Logger(EtsyAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.ETSY ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const direct = credentials.accessToken?.trim();
    if (direct) {
      return direct;
    }
    const clientId = credentials.apiKey?.trim();
    const clientSecret = credentials.apiSecret?.trim();
    const refreshToken = credentials.refreshToken?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Etsy: apiKey, apiSecret ve refreshToken (veya accessToken) zorunludur',
      );
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
    });
    const { data } = await axios.post<{ access_token?: string }>(
      ETSY_TOKEN_URL,
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-key': clientId,
        },
        auth: { username: clientId, password: clientSecret },
        timeout: 20_000,
      },
    );
    const token = typeof data.access_token === 'string' ? data.access_token : '';
    if (!token) {
      throw new Error('Etsy: access_token alınamadı');
    }
    return token;
  }

  private headers(
    apiKey: string,
    token: string,
  ): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        'x-api-key': apiKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        return false;
      }
      const token = await this.getAccessToken(credentials);
      const shopId = credentials.shopId?.trim();
      if (!shopId) {
        return false;
      }
      const url = `${ETSY_BASE}/shops/${shopId}/listings/active`;
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url,
          timeout: 12_000,
          params: { limit: 1, includes: 'MainImage,Inventory' },
          ...this.headers(apiKey, token),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Etsy bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private receiptToOrder(r: EtsyReceipt): MarketplaceOrder | null {
    const id = r.receipt_id;
    if (typeof id !== 'number' && typeof id !== 'string') {
      return null;
    }
    const created =
      typeof r.creation_tsz === 'number'
        ? new Date(r.creation_tsz * 1000).toISOString()
        : new Date().toISOString();
    const name =
      typeof r.name === 'string' && r.name.length > 0
        ? r.name
        : typeof r.buyer_email === 'string'
          ? r.buyer_email
          : '—';
    const txs = Array.isArray(r.transactions) ? r.transactions : [];
    const grand = r.Grandtotal;
    let total = 0;
    if (isRecord(grand)) {
      const amt = grand.amount;
      const div = grand.divisor;
      if (typeof amt === 'number' && typeof div === 'number' && div !== 0) {
        total = amt / div;
      }
    }
    if (total === 0) {
      for (const t of txs) {
        const price = t.price;
        if (isRecord(price)) {
          const a = price.amount;
          const d = price.divisor;
          const q = t.quantity;
          if (
            typeof a === 'number' &&
            typeof d === 'number' &&
            d !== 0 &&
            typeof q === 'number'
          ) {
            total += (a / d) * q;
          }
        }
      }
    }
    return {
      platformOrderId: String(id),
      status: typeof r.status === 'string' ? r.status : 'NEW',
      customerName: name,
      items: txs.map((t: EtsyTransaction) => {
        const price = t.price;
        let unit = 0;
        if (isRecord(price)) {
          const a = price.amount;
          const d = price.divisor;
          if (typeof a === 'number' && typeof d === 'number' && d !== 0) {
            unit = a / d;
          }
        }
        const skuArr = Array.isArray(t.sku) ? t.sku : [];
        const sku = skuArr.length > 0 && typeof skuArr[0] === 'string' ? skuArr[0] : '';
        return {
          sku,
          barcode: sku,
          quantity:
            typeof t.quantity === 'number' && Number.isFinite(t.quantity)
              ? Math.max(0, Math.round(t.quantity))
              : 0,
          unitPrice: unit,
          platformItemId:
            t.listing_id !== undefined ? String(t.listing_id) : sku,
          productName: typeof t.title === 'string' ? t.title : undefined,
        };
      }),
      totalAmount: total,
      currency:
        isRecord(grand) && typeof grand.currency_code === 'string'
          ? grand.currency_code
          : 'USD',
      createdAt: created,
    };
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const shopId = credentials.shopId?.trim();
      if (!apiKey || !shopId) {
        throw new Error('Etsy: apiKey ve shopId zorunludur');
      }
      const token = await this.getAccessToken(credentials);
      const url = `${ETSY_BASE}/shops/${shopId}/receipts`;
      const sinceMs = since ? since.getTime() : undefined;
      let rows: MarketplaceOrder[] = [];
      await withRateLimit('ETSY', this.rpm(), async () => {
        const data = await axiosWithRetry<EtsyReceiptsResponse>(
          {
            method: 'GET',
            url,
            timeout: 25_000,
            params: {
              limit: 100,
              was_paid: true,
              was_shipped: false,
              ...(sinceMs !== undefined
                ? { min_created: Math.floor(sinceMs / 1000) }
                : {}),
            },
            ...this.headers(apiKey, token),
          },
          {},
        );
        const results = Array.isArray(data.results) ? data.results : [];
        rows = results
          .map((r) => this.receiptToOrder(r))
          .filter((x): x is MarketplaceOrder => x !== null);
      });
      return rows;
    } catch (error) {
      throwSyncFailed('ETSY', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const shopId = credentials.shopId?.trim();
      if (!apiKey || !shopId) {
        throw new Error('Etsy: apiKey ve shopId zorunludur');
      }
      const token = await this.getAccessToken(credentials);
      const url = `${ETSY_BASE}/shops/${shopId}/listings/active`;
      const offset = page * 100;
      const { rows, total } = await withRateLimit('ETSY', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params: {
              limit: 100,
              offset,
              includes: 'MainImage,Inventory',
            },
            ...this.headers(apiKey, token),
          },
          {},
        );
        return normalizeProductRows(data);
      });
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? (row as EtsyListing) : {};
        const listingId = p.listing_id;
        const id =
          typeof listingId === 'number' ? String(listingId) : `row-${i}`;
        const skuArr = Array.isArray(p.sku) ? p.sku : [];
        const barcode =
          skuArr.length > 0 && typeof skuArr[0] === 'string' ? skuArr[0] : id;
        const title =
          typeof p.title === 'string' ? p.title : barcode;
        const price = p.price;
        let sale = 0;
        if (isRecord(price)) {
          const a = price.amount;
          const d = price.divisor;
          if (typeof a === 'number' && typeof d === 'number' && d !== 0) {
            sale = a / d;
          }
        }
        const qty =
          typeof p.quantity === 'number' && Number.isFinite(p.quantity)
            ? Math.max(0, Math.round(p.quantity))
            : 0;
        const images: string[] = [];
        if (Array.isArray(p.Images)) {
          for (const im of p.Images) {
            if (
              isRecord(im) &&
              typeof im.url_fullxfull === 'string' &&
              im.url_fullxfull.length > 0
            ) {
              images.push(im.url_fullxfull);
            }
          }
        }
        return {
          platformProductId: id,
          barcode,
          title,
          quantity: qty,
          salePrice: sale,
          listPrice: sale,
          approved: true,
          images,
        };
      });
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize: 100,
      };
    } catch (error) {
      throwSyncFailed('ETSY', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const shopId = credentials.shopId?.trim();
      if (!apiKey || !shopId) {
        throw new Error('Etsy: apiKey ve shopId zorunludur');
      }
      const token = await this.getAccessToken(credentials);
      await withRateLimit('ETSY', this.rpm(), async () => {
        for (const u of updates) {
          const listingId = u.barcode;
          const url = `${ETSY_BASE}/listings/${listingId}/inventory`;
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url,
              timeout: 20_000,
              data: {
                products: [
                  {
                    sku: u.barcode,
                    offerings: [
                      {
                        quantity: Math.max(0, Math.round(u.quantity)),
                        is_enabled: u.quantity > 0,
                      },
                    ],
                  },
                ],
              },
              ...this.headers(apiKey, token),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('ETSY', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      const shopId = credentials.shopId?.trim();
      if (!apiKey || !shopId) {
        throw new Error('Etsy: apiKey ve shopId zorunludur');
      }
      const token = await this.getAccessToken(credentials);
      await withRateLimit('ETSY', this.rpm(), async () => {
        for (const u of updates) {
          const listingId = u.barcode;
          const url = `${ETSY_BASE}/shops/${shopId}/listings/${listingId}`;
          await axiosWithRetry<unknown>(
            {
              method: 'PATCH',
              url,
              timeout: 20_000,
              data: { price: u.salePrice },
              ...this.headers(apiKey, token),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('ETSY', 'updatePrice', error);
    }
  }
}
