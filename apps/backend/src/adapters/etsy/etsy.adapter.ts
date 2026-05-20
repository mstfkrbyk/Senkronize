import { Injectable, Logger } from '@nestjs/common';
import type { AxiosRequestConfig } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

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
import { ETSY_API_BASE } from './etsy.constants';
import { refreshEtsyAccessToken } from './etsy.oauth';
import type {
  EtsyListing,
  EtsyReceipt,
  EtsyReceiptsResponse,
  EtsyTransaction,
} from './etsy.types';

export interface EtsyTrackingPayload {
  receiptId: string;
  trackingCode: string;
  carrierName: string;
  sendBcc?: boolean;
}

@Injectable()
export class EtsyAdapter implements IMarketplaceAdapter {
  readonly platform = 'ETSY';
  private readonly logger = new Logger(EtsyAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.ETSY ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const direct = credentials.accessToken?.trim();
    const expiresRaw = credentials.tokenExpiresAt?.trim();
    if (direct && expiresRaw) {
      const expiresAt = Number.parseInt(expiresRaw, 10);
      if (Number.isFinite(expiresAt) && Date.now() < expiresAt - 5 * 60 * 1000) {
        return direct;
      }
    } else if (direct && !credentials.refreshToken?.trim()) {
      return direct;
    }

    const clientId = credentials.apiKey?.trim();
    const clientSecret = credentials.apiSecret?.trim();
    const refreshToken = credentials.refreshToken?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Etsy: apiKey, apiSecret ve refreshToken (veya geçerli accessToken) zorunludur',
      );
    }
    const tokens = await refreshEtsyAccessToken(clientId, clientSecret, refreshToken);
    credentials.accessToken = tokens.accessToken;
    credentials.refreshToken = tokens.refreshToken;
    credentials.tokenExpiresAt = String(tokens.tokenExpiresAt);
    return tokens.accessToken;
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

  private resolveCredentials(credentials: Record<string, string>): {
    apiKey: string;
    shopId: string;
  } {
    const apiKey = credentials.apiKey?.trim() ?? '';
    const shopId = credentials.shopId?.trim() ?? '';
    if (!apiKey || !shopId) {
      throw new Error('Etsy: apiKey ve shopId zorunludur');
    }
    return { apiKey, shopId };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { apiKey, shopId } = this.resolveCredentials(credentials);
      const token = await this.getAccessToken(credentials);
      const url = `${ETSY_API_BASE}/shops/${shopId}/listings/active`;
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
      const { apiKey, shopId } = this.resolveCredentials(credentials);
      const token = await this.getAccessToken(credentials);
      const url = `${ETSY_API_BASE}/shops/${shopId}/receipts`;
      const sinceSec = since ? Math.floor(since.getTime() / 1000) : undefined;
      const maxCreated = Math.floor(Date.now() / 1000);
      const rows: MarketplaceOrder[] = [];
      let offset = 0;
      const limit = 100;

      await withRateLimit('ETSY', this.rpm(), async () => {
        for (;;) {
          const data = await axiosWithRetry<EtsyReceiptsResponse>(
            {
              method: 'GET',
              url,
              timeout: 25_000,
              params: {
                limit,
                offset,
                was_paid: true,
                ...(sinceSec !== undefined ? { min_created: sinceSec } : {}),
                max_created: maxCreated,
              },
              ...this.headers(apiKey, token),
            },
            {},
          );
          const results = Array.isArray(data.results) ? data.results : [];
          for (const r of results) {
            const mapped = this.receiptToOrder(r);
            if (mapped) {
              rows.push(mapped);
            }
          }
          if (results.length < limit) {
            break;
          }
          offset += limit;
        }
      });
      return rows;
    } catch (error) {
      throwSyncFailed('ETSY', 'getOrders', error);
    }
  }

  async getListing(
    credentials: Record<string, string>,
    listingId: string,
  ): Promise<EtsyListing | null> {
    const { apiKey } = this.resolveCredentials(credentials);
    const token = await this.getAccessToken(credentials);
    const url = `${ETSY_API_BASE}/listings/${listingId}`;
    const data = await axiosWithRetry<EtsyListing>(
      {
        method: 'GET',
        url,
        timeout: 20_000,
        params: { includes: 'MainImage,Inventory' },
        ...this.headers(apiKey, token),
      },
      {},
    );
    return isRecord(data) ? data : null;
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const { apiKey, shopId } = this.resolveCredentials(credentials);
      const token = await this.getAccessToken(credentials);
      const url = `${ETSY_API_BASE}/shops/${shopId}/listings/active`;
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
        const title = typeof p.title === 'string' ? p.title : barcode;
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
      const { apiKey } = this.resolveCredentials(credentials);
      const token = await this.getAccessToken(credentials);
      await withRateLimit('ETSY', this.rpm(), async () => {
        for (const u of updates) {
          const listingId = u.barcode;
          const url = `${ETSY_API_BASE}/listings/${listingId}/inventory`;
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
      const { apiKey } = this.resolveCredentials(credentials);
      const token = await this.getAccessToken(credentials);
      await withRateLimit('ETSY', this.rpm(), async () => {
        for (const u of updates) {
          const listingId = u.barcode;
          const url = `${ETSY_API_BASE}/listings/${listingId}`;
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
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

  /** Kargo takip numarası bildirimi — POST receipts/{receiptId}/tracking */
  async submitTracking(
    credentials: Record<string, string>,
    payload: EtsyTrackingPayload,
  ): Promise<void> {
    try {
      const { apiKey, shopId } = this.resolveCredentials(credentials);
      const token = await this.getAccessToken(credentials);
      const url = `${ETSY_API_BASE}/shops/${shopId}/receipts/${payload.receiptId}/tracking`;
      await withRateLimit('ETSY', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url,
            timeout: 20_000,
            data: {
              tracking_code: payload.trackingCode,
              carrier_name: payload.carrierName,
              send_bcc: payload.sendBcc ?? false,
            },
            ...this.headers(apiKey, token),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('ETSY', 'submitTracking', error);
    }
  }
}
