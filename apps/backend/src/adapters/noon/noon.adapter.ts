import { Buffer } from 'node:buffer';

import { Injectable, Logger } from '@nestjs/common';
import type { AxiosError, AxiosRequestConfig } from 'axios';
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
  MarketplaceTokenCache,
  marketplaceTokenCacheKey,
} from '../common/marketplace-token-cache';
import { isRecord, parseMoney, throwSyncFailed } from '../stub-helpers';
import {
  NOON_API_BASE,
  NOON_DEFAULT_CURRENCY,
  NOON_ORDERS_PAGE_SIZE,
  NOON_PRODUCTS_PAGE_SIZE,
} from './noon.constants';
import { fetchNoonClientCredentialsToken } from './noon.oauth';
import type {
  NoonOrderRow,
  NoonOrdersEnvelope,
  NoonProductRow,
  NoonProductsEnvelope,
} from './noon.types';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function isNoonUnauthorized(err: unknown): boolean {
  const ax = err as AxiosError;
  return ax.response?.status === 401;
}

@Injectable()
export class NoonAdapter implements IMarketplaceAdapter {
  readonly platform = 'NOON';
  private readonly logger = new Logger(NoonAdapter.name);

  constructor(private readonly tokenCache: MarketplaceTokenCache) {}

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.NOON ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private resolveApiKeyAuth(credentials: Record<string, string>): {
    apiKey: string;
    apiSecret: string;
  } | null {
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!apiKey || !apiSecret) {
      return null;
    }
    return { apiKey, apiSecret };
  }

  private resolveOAuthClients(credentials: Record<string, string>): {
    clientId: string;
    clientSecret: string;
  } | null {
    const clientId =
      credentials.clientId?.trim() || credentials.apiKey?.trim() || '';
    const clientSecret =
      credentials.clientSecret?.trim() ||
      credentials.apiSecret?.trim() ||
      credentials.secretKey?.trim() ||
      '';
    if (!clientId || !clientSecret) {
      return null;
    }
    return { clientId, clientSecret };
  }

  private tokenCacheKey(credentials: Record<string, string>): string {
    const oauth = this.resolveOAuthClients(credentials);
    const seed = oauth
      ? `${oauth.clientId}:${oauth.clientSecret}`
      : `${credentials.apiKey?.trim() ?? ''}:${credentials.apiSecret?.trim() ?? ''}`;
    return marketplaceTokenCacheKey(this.platform, seed);
  }

  private async ensureAccessToken(
    credentials: Record<string, string>,
    forceRefresh = false,
  ): Promise<{ mode: 'bearer' | 'basic'; token: string; secret?: string }> {
    const oauth = this.resolveOAuthClients(credentials);
    if (!oauth) {
      const keyAuth = this.resolveApiKeyAuth(credentials);
      if (!keyAuth) {
        throw new Error('Noon: apiKey/apiSecret veya clientId/clientSecret zorunludur');
      }
      return { mode: 'basic', token: keyAuth.apiKey, secret: keyAuth.apiSecret };
    }

    const cacheKey = this.tokenCacheKey(credentials);
    if (!forceRefresh) {
      const cached = await this.tokenCache.get(cacheKey);
      if (cached) {
        credentials.accessToken = cached;
        return { mode: 'bearer', token: cached };
      }
      const direct = credentials.accessToken?.trim();
      const expiresRaw = credentials.tokenExpiresAt?.trim();
      if (direct && expiresRaw) {
        const expiresAt = Number.parseInt(expiresRaw, 10);
        if (
          Number.isFinite(expiresAt) &&
          Date.now() < expiresAt - TOKEN_REFRESH_BUFFER_MS
        ) {
          return { mode: 'bearer', token: direct };
        }
      } else if (direct) {
        return { mode: 'bearer', token: direct };
      }
    }

    const tokens = await fetchNoonClientCredentialsToken(
      oauth.clientId,
      oauth.clientSecret,
    );
    credentials.accessToken = tokens.accessToken;
    credentials.tokenExpiresAt = String(tokens.tokenExpiresAt);
    const ttlSec = Math.max(
      60,
      Math.floor((tokens.tokenExpiresAt - Date.now()) / 1000) - 300,
    );
    await this.tokenCache.set(cacheKey, tokens.accessToken, ttlSec);
    return { mode: 'bearer', token: tokens.accessToken };
  }

  private authConfig(
    auth: { mode: 'bearer' | 'basic'; token: string; secret?: string },
  ): Pick<AxiosRequestConfig, 'headers'> {
    if (auth.mode === 'bearer') {
      return {
        headers: {
          Authorization: `Bearer ${auth.token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      };
    }
    const basic = Buffer.from(`${auth.token}:${auth.secret ?? ''}`).toString('base64');
    return {
      headers: {
        Authorization: `Basic ${basic}`,
        'X-Api-Key': auth.token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };
  }

  private async request<T>(
    credentials: Record<string, string>,
    config: AxiosRequestConfig,
    retried = false,
  ): Promise<T> {
    const auth = await this.ensureAccessToken(credentials);
    try {
      return await axiosWithRetry<T>(
        {
          timeout: 25_000,
          ...config,
          headers: {
            ...this.authConfig(auth).headers,
            ...config.headers,
          },
        },
        {},
      );
    } catch (err) {
      if (
        !retried &&
        isNoonUnauthorized(err) &&
        this.resolveOAuthClients(credentials)
      ) {
        await this.tokenCache.invalidate(this.tokenCacheKey(credentials));
        await this.ensureAccessToken(credentials, true);
        return this.request<T>(credentials, config, true);
      }
      throw err;
    }
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await withRateLimit('NOON', this.rpm(), async () => {
        await this.request<unknown>(credentials, {
          method: 'GET',
          url: `${NOON_API_BASE}/orders`,
          params: { page: 1, limit: 1 },
        });
      });
      return true;
    } catch (error) {
      this.logger.warn('Noon bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private extractOrderRows(data: unknown): NoonOrderRow[] {
    if (!isRecord(data)) {
      return [];
    }
    const env = data as NoonOrdersEnvelope;
    if (Array.isArray(env.data)) {
      return env.data;
    }
    if (Array.isArray(env.orders)) {
      return env.orders;
    }
    if (Array.isArray(env.results)) {
      return env.results;
    }
    if (Array.isArray(env.items)) {
      return env.items;
    }
    return [];
  }

  private mapOrder(row: NoonOrderRow): MarketplaceOrder | null {
    const idRaw = row.order_nr ?? row.order_number ?? row.id;
    if (typeof idRaw !== 'string' || idRaw.length === 0) {
      return null;
    }
    const createdRaw = row.created_at;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const lines = Array.isArray(row.items) ? row.items : [];
    const currency =
      typeof row.currency_code === 'string' ? row.currency_code : NOON_DEFAULT_CURRENCY;
    let total = parseMoney(row.total);
    if (total <= 0 && lines.length > 0) {
      total = lines.reduce(
        (acc, l) =>
          acc +
          parseMoney(l.unit_price) *
            (typeof l.quantity === 'number' && Number.isFinite(l.quantity)
              ? Math.max(1, l.quantity)
              : 1),
        0,
      );
    }
    return {
      platformOrderId: idRaw,
      status: typeof row.status === 'string' ? row.status : 'CREATED',
      customerName: '—',
      items: lines.map((l, i) => {
        const sku =
          typeof l.partner_sku === 'string'
            ? l.partner_sku
            : typeof l.sku === 'string'
              ? l.sku
              : `line-${String(i)}`;
        return {
          sku,
          barcode: sku,
          quantity:
            typeof l.quantity === 'number' && Number.isFinite(l.quantity)
              ? Math.max(0, Math.round(l.quantity))
              : 1,
          unitPrice: parseMoney(l.unit_price),
          platformItemId: sku,
          productName: typeof l.title === 'string' ? l.title : undefined,
        };
      }),
      totalAmount: total,
      currency,
      createdAt,
    };
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const orders: MarketplaceOrder[] = [];
      let page = 1;
      const limit = NOON_ORDERS_PAGE_SIZE;
      const params: Record<string, string | number> = {
        page,
        limit,
        status: 'pending',
      };
      if (since) {
        params.updated_after = since.toISOString();
        params.created_after = since.toISOString();
      }

      for (;;) {
        const data = await withRateLimit('NOON', this.rpm(), async () =>
          this.request<unknown>(credentials, {
            method: 'GET',
            url: `${NOON_API_BASE}/orders`,
            params: { ...params, page },
          }),
        );
        const rows = this.extractOrderRows(data);
        if (rows.length === 0) {
          break;
        }
        for (const row of rows) {
          const mapped = this.mapOrder(row);
          if (mapped) {
            orders.push(mapped);
          }
        }
        if (rows.length < limit) {
          break;
        }
        page += 1;
      }
      return orders;
    } catch (error) {
      throwSyncFailed(this.platform, 'getOrders', error);
    }
  }

  private extractProductRows(data: unknown): { rows: NoonProductRow[]; total?: number } {
    if (!isRecord(data)) {
      return { rows: [] };
    }
    const env = data as NoonProductsEnvelope;
    const rows =
      (Array.isArray(env.data) && env.data) ||
      (Array.isArray(env.products) && env.products) ||
      (Array.isArray(env.results) && env.results) ||
      (Array.isArray(env.items) && env.items) ||
      [];
    const total =
      typeof env.total === 'number'
        ? env.total
        : typeof env.count === 'number'
          ? env.count
          : undefined;
    return { rows, total };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const limit = NOON_PRODUCTS_PAGE_SIZE;
      const apiPage = page + 1;
      const data = await withRateLimit('NOON', this.rpm(), async () =>
        this.request<unknown>(credentials, {
          method: 'GET',
          url: `${NOON_API_BASE}/products`,
          params: { page: apiPage, limit },
        }),
      );
      const { rows, total } = this.extractProductRows(data);
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const sku =
          typeof row.partner_sku === 'string'
            ? row.partner_sku
            : typeof row.sku === 'string'
              ? row.sku
              : `row-${i}`;
        const title =
          typeof row.title === 'string'
            ? row.title
            : typeof row.name === 'string'
              ? row.name
              : sku;
        const qtyRaw = row.quantity ?? row.stock ?? row.available_quantity ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        const sale = parseMoney(row.selling_price ?? row.price);
        return {
          platformProductId: sku,
          barcode: sku,
          title,
          quantity,
          salePrice: sale,
          listPrice: parseMoney(row.list_price ?? row.price ?? sale),
          approved: row.status !== 'inactive' && row.status !== 'rejected',
          images: [],
        };
      });
      return {
        items,
        total: total ?? items.length,
        page,
        pageSize: limit,
      };
    } catch (error) {
      throwSyncFailed(this.platform, 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      await withRateLimit('NOON', this.rpm(), async () => {
        for (const u of updates) {
          await this.request<unknown>(credentials, {
            method: 'PUT',
            url: `${NOON_API_BASE}/products/${encodeURIComponent(u.barcode)}/inventory`,
            data: { quantity: u.quantity, available_quantity: u.quantity },
          });
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      await withRateLimit('NOON', this.rpm(), async () => {
        for (const u of updates) {
          await this.request<unknown>(credentials, {
            method: 'PUT',
            url: `${NOON_API_BASE}/products/${encodeURIComponent(u.barcode)}/price`,
            data: {
              price: u.salePrice,
              selling_price: u.salePrice,
              list_price: u.listPrice,
            },
          });
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }

  /** Kargo bildirimi — POST /orders/{id}/ship */
  async fulfillOrder(
    credentials: Record<string, string>,
    platformOrderId: string,
    trackingNumber: string,
    carrier: string,
  ): Promise<void> {
    try {
      await withRateLimit('NOON', this.rpm(), async () => {
        await this.request<unknown>(credentials, {
          method: 'POST',
          url: `${NOON_API_BASE}/orders/${encodeURIComponent(platformOrderId)}/ship`,
          data: {
            tracking_number: trackingNumber,
            carrier,
          },
        });
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'fulfillOrder', error);
    }
  }
}
