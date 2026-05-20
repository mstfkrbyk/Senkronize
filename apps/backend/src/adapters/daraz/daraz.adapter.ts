import { Injectable, Logger } from '@nestjs/common';
import type { AxiosError } from 'axios';
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
  MarketplaceTokenCache,
  marketplaceTokenCacheKey,
} from '../common/marketplace-token-cache';
import {
  isRecord,
  normalizeProductRows,
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import { DARAZ_ORDER_BATCH_SIZE } from './daraz.constants';
import {
  buildDarazAuthorizeUrl,
  darazBusinessApiBase,
  darazSign,
  refreshDarazAccessToken,
} from './daraz.oauth';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function unwrapDarazData(data: unknown): unknown {
  if (!isRecord(data)) {
    return data;
  }
  const code = data.code;
  if (code !== undefined && code !== '0' && code !== 0) {
    const msg = typeof data.message === 'string' ? data.message : 'Daraz API hatası';
    throw new Error(msg);
  }
  return data.data ?? data;
}

function isDarazUnauthorized(err: unknown): boolean {
  const ax = err as AxiosError<{ code?: string | number; message?: string }>;
  if (ax.response?.status === 401) {
    return true;
  }
  const code = ax.response?.data?.code;
  if (code === 'IllegalAccessToken' || code === 401 || code === '401') {
    return true;
  }
  const msg = ax.response?.data?.message ?? (err instanceof Error ? err.message : '');
  return typeof msg === 'string' && /access.?token|unauthorized|illegal/i.test(msg);
}

@Injectable()
export class DarazAdapter implements IMarketplaceAdapter {
  readonly platform = 'DARAZ';
  private readonly logger = new Logger(DarazAdapter.name);

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly tokenCache: MarketplaceTokenCache,
  ) {
    void this.encryptionService;
  }

  getAuthorizationUrl(
    credentials: Record<string, string>,
    state: string,
    redirectUri: string,
  ): string {
    const appKey = credentials.appKey?.trim() ?? credentials.apiKey?.trim() ?? '';
    if (!appKey) {
      throw new Error('Daraz: appKey zorunludur');
    }
    return buildDarazAuthorizeUrl(appKey, redirectUri, state);
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.DARAZ ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private requireAppKeySecret(credentials: Record<string, string>): {
    appKey: string;
    appSecret: string;
  } {
    const appKey = credentials.appKey?.trim() ?? credentials.apiKey?.trim();
    const appSecret =
      credentials.appSecret?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.secretKey?.trim();
    if (!appKey || !appSecret) {
      throw new Error('Daraz: appKey ve appSecret zorunludur');
    }
    return { appKey, appSecret };
  }

  private requireCreds(credentials: Record<string, string>): {
    appKey: string;
    appSecret: string;
    accessToken: string;
  } {
    const { appKey, appSecret } = this.requireAppKeySecret(credentials);
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken) {
      throw new Error('Daraz: accessToken zorunludur');
    }
    return { appKey, appSecret, accessToken };
  }

  private tokenCacheKey(credentials: Record<string, string>): string {
    const appKey = credentials.appKey?.trim() ?? credentials.apiKey?.trim() ?? '';
    const refresh = credentials.refreshToken?.trim() ?? '';
    const access = credentials.accessToken?.trim() ?? '';
    return marketplaceTokenCacheKey(
      this.platform,
      `${appKey}:${refresh || access}`,
    );
  }

  private async ensureAccessToken(
    credentials: Record<string, string>,
    forceRefresh = false,
  ): Promise<string> {
    const { appKey, appSecret } = this.requireAppKeySecret(credentials);
    const cacheKey = this.tokenCacheKey(credentials);

    if (!forceRefresh) {
      const cached = await this.tokenCache.get(cacheKey);
      if (cached) {
        credentials.accessToken = cached;
        return cached;
      }
      const direct = credentials.accessToken?.trim();
      const expiresRaw = credentials.tokenExpiresAt?.trim();
      if (direct && expiresRaw) {
        const expiresAt = Number.parseInt(expiresRaw, 10);
        if (
          Number.isFinite(expiresAt) &&
          Date.now() < expiresAt - TOKEN_REFRESH_BUFFER_MS
        ) {
          return direct;
        }
      } else if (direct && !credentials.refreshToken?.trim()) {
        return direct;
      }
    }

    const refreshToken = credentials.refreshToken?.trim();
    if (!refreshToken) {
      const fallback = credentials.accessToken?.trim();
      if (fallback) {
        return fallback;
      }
      throw new Error('Daraz: refreshToken veya geçerli accessToken zorunludur');
    }

    const tokens = await refreshDarazAccessToken(appKey, appSecret, refreshToken);
    credentials.accessToken = tokens.accessToken;
    credentials.refreshToken = tokens.refreshToken;
    credentials.tokenExpiresAt = String(tokens.tokenExpiresAt);
    const ttlSec = Math.max(
      60,
      Math.floor((tokens.tokenExpiresAt - Date.now()) / 1000) - 300,
    );
    await this.tokenCache.set(cacheKey, tokens.accessToken, ttlSec);
    return tokens.accessToken;
  }

  private async invoke<T>(
    credentials: Record<string, string>,
    apiName: string,
    params: Record<string, string> = {},
    method: 'GET' | 'POST' = 'GET',
    retried = false,
  ): Promise<T> {
    await this.ensureAccessToken(credentials);
    const { appKey, appSecret, accessToken } = this.requireCreds(credentials);
    const base = darazBusinessApiBase(credentials);
    const timestamp = String(Date.now());
    const signParams: Record<string, string> = {
      app_key: appKey,
      access_token: accessToken,
      sign_method: 'sha256',
      timestamp,
      ...params,
    };
    const sign = darazSign(apiName, signParams, appSecret);
    try {
      const data = await axiosWithRetry<unknown>(
        {
          method,
          url: `${base}${apiName}`,
          timeout: 25_000,
          params: { ...signParams, sign },
        },
        {},
      );
      return unwrapDarazData(data) as T;
    } catch (err) {
      if (!retried && isDarazUnauthorized(err) && credentials.refreshToken?.trim()) {
        await this.tokenCache.invalidate(this.tokenCacheKey(credentials));
        await this.ensureAccessToken(credentials, true);
        return this.invoke<T>(credentials, apiName, params, method, true);
      }
      throw err;
    }
  }

  private mapOrder(row: unknown, lines: unknown[] = []): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const idRaw = row.order_id ?? row.order_number ?? row.id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const createdRaw = row.created_at ?? row.create_time;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : typeof createdRaw === 'number' && Number.isFinite(createdRaw)
          ? new Date(createdRaw).toISOString()
          : new Date().toISOString();
    const firstName =
      typeof row.customer_first_name === 'string' ? row.customer_first_name : '';
    const lastName =
      typeof row.customer_last_name === 'string' ? row.customer_last_name : '';
    const combined = `${firstName} ${lastName}`.trim();
    const name =
      combined.length > 0
        ? combined
        : typeof row.buyer_name === 'string'
          ? row.buyer_name
          : typeof row.customer_name === 'string'
            ? row.customer_name
            : '—';
    return {
      platformOrderId: String(idRaw),
      status:
        typeof row.statuses === 'string'
          ? row.statuses
          : typeof row.status === 'string'
            ? row.status
            : 'NEW',
      customerName: name.length > 0 ? name : '—',
      items: lines.filter(isRecord).map((l) => ({
        sku:
          typeof l.sku === 'string'
            ? l.sku
            : typeof l.shop_sku === 'string'
              ? l.shop_sku
              : String(l.seller_sku ?? ''),
        barcode:
          typeof l.shop_sku === 'string'
            ? l.shop_sku
            : typeof l.seller_sku === 'string'
              ? l.seller_sku
              : String(l.sku ?? ''),
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.item_price ?? l.paid_price ?? l.price ?? l.unit_price),
        platformItemId:
          l.order_item_id !== undefined && l.order_item_id !== null
            ? String(l.order_item_id)
            : String(l.sku ?? ''),
        productName:
          typeof l.name === 'string'
            ? l.name
            : typeof l.product_name === 'string'
              ? l.product_name
              : undefined,
      })),
      totalAmount: parseMoney(row.price ?? row.total_amount ?? row.grand_total),
      currency: typeof row.currency === 'string' ? row.currency : 'LKR',
      createdAt,
      cargoTrackingNumber:
        typeof row.tracking_code === 'string' ? row.tracking_code : undefined,
      cargoProvider:
        typeof row.shipment_provider === 'string' ? row.shipment_provider : undefined,
    };
  }

  private extractOrderRows(page: unknown): unknown[] {
    if (Array.isArray(page)) {
      return page;
    }
    if (isRecord(page) && Array.isArray(page.orders)) {
      return page.orders;
    }
    return [];
  }

  private extractOrderId(row: unknown): string | null {
    if (!isRecord(row)) {
      return null;
    }
    const idRaw = row.order_id ?? row.order_number ?? row.id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    return String(idRaw);
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await withRateLimit('DARAZ', this.rpm(), async () => {
        await this.invoke<unknown>(credentials, '/seller/get');
      });
      return true;
    } catch (error) {
      this.logger.warn('Daraz bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const orderIdSet = new Set<string>();
      const timeFilters: Array<Record<string, string>> = since
        ? [
            { create_after: since.toISOString() },
            { update_after: since.toISOString() },
          ]
        : [{}];

      for (const timeFilter of timeFilters) {
        let offset = 0;
        const limit = 100;
        for (;;) {
          const params: Record<string, string> = {
            limit: String(limit),
            offset: String(offset),
            ...timeFilter,
          };
          const page = await withRateLimit('DARAZ', this.rpm(), async () =>
            this.invoke<unknown>(credentials, '/orders/get', params),
          );
          const rows = this.extractOrderRows(page);
          for (const row of rows) {
            const id = this.extractOrderId(row);
            if (id) {
              orderIdSet.add(id);
            }
          }
          if (rows.length < limit) {
            break;
          }
          offset += limit;
        }
      }

      const orderIds = [...orderIdSet];
      if (orderIds.length === 0) {
        return [];
      }

      const orders: MarketplaceOrder[] = [];
      for (let i = 0; i < orderIds.length; i += DARAZ_ORDER_BATCH_SIZE) {
        const chunk = orderIds.slice(i, i + DARAZ_ORDER_BATCH_SIZE);
        const detailPage = await withRateLimit('DARAZ', this.rpm(), async () =>
          this.invoke<unknown>(credentials, '/orders/get', {
            order_ids: JSON.stringify(chunk),
          }),
        );
        const detailRows = this.extractOrderRows(detailPage);
        const rowById = new Map<string, Record<string, unknown>>();
        for (const row of detailRows) {
          const id = this.extractOrderId(row);
          if (id && isRecord(row)) {
            rowById.set(id, row);
          }
        }

        for (const orderId of chunk) {
          const row =
            rowById.get(orderId) ??
            (isRecord(detailPage) && isRecord(detailPage[orderId])
              ? (detailPage[orderId] as Record<string, unknown>)
              : { order_id: orderId });
          const itemsData = await withRateLimit('DARAZ', this.rpm(), async () =>
            this.invoke<unknown>(credentials, '/orders/items/get', {
              order_id: orderId,
            }),
          );
          const lines = Array.isArray(itemsData)
            ? itemsData
            : isRecord(itemsData) && Array.isArray(itemsData.order_items)
              ? itemsData.order_items
              : [];
          const mapped = this.mapOrder(row, lines);
          if (mapped) {
            orders.push(mapped);
          }
        }
      }
      return orders;
    } catch (error) {
      throwSyncFailed(this.platform, 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const limit = 50;
      const offset = page * limit;
      const data = await withRateLimit('DARAZ', this.rpm(), async () =>
        this.invoke<unknown>(credentials, '/products/get', {
          filter: 'all',
          limit: String(limit),
          offset: String(offset),
        }),
      );
      const { rows, total } = normalizeProductRows(data);
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const skus = Array.isArray(p.skus) ? p.skus : [];
        const firstSku = skus.length > 0 && isRecord(skus[0]) ? skus[0] : p;
        const idRaw = firstSku.SkuId ?? firstSku.sku_id ?? p.item_id ?? p.id;
        const id =
          idRaw !== undefined && idRaw !== null ? String(idRaw) : `row-${i}`;
        const barcode =
          typeof firstSku.SellerSku === 'string'
            ? firstSku.SellerSku
            : typeof firstSku.seller_sku === 'string'
              ? firstSku.seller_sku
              : id;
        const attrs = isRecord(p.attributes) ? p.attributes : null;
        const titleRaw =
          (attrs && typeof attrs.name === 'string' ? attrs.name : null) ?? p.name ?? barcode;
        const title =
          typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
        const sale = parseMoney(firstSku.price ?? firstSku.special_price ?? p.price);
        const qtyRaw = firstSku.quantity ?? firstSku.available ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        return {
          platformProductId: id,
          barcode,
          title,
          quantity,
          salePrice: sale,
          listPrice: parseMoney(firstSku.price ?? sale),
          approved: p.status !== 'inactive',
          images: [],
        };
      });
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize: limit,
      };
    } catch (error) {
      throwSyncFailed(this.platform, 'getListings', error);
    }
  }

  private async updatePriceQuantity(
    credentials: Record<string, string>,
    skus: Array<Record<string, string | number>>,
  ): Promise<void> {
    await withRateLimit('DARAZ', this.rpm(), async () => {
      await this.invoke<unknown>(
        credentials,
        '/product/price_quantity/update',
        {
          payload: JSON.stringify({
            product: { skus },
          }),
        },
        'POST',
      );
    });
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const skus = updates.map((u) => ({
        SellerSku: u.barcode,
        quantity: u.quantity,
      }));
      await this.updatePriceQuantity(credentials, skus);
    } catch (error) {
      throwSyncFailed(this.platform, 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const skus = updates.map((u) => ({
        SellerSku: u.barcode,
        price: u.salePrice,
      }));
      await this.updatePriceQuantity(credentials, skus);
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }

  /** Kargo bildirimi — pack + takip numarası */
  async fulfillOrder(
    credentials: Record<string, string>,
    orderItemIds: string[],
    shipmentProvider: string,
    trackingNumber: string,
  ): Promise<void> {
    try {
      await withRateLimit('DARAZ', this.rpm(), async () => {
        await this.invoke<unknown>(
          credentials,
          '/order/fulfillment/pack',
          {
            order_item_ids: JSON.stringify(orderItemIds),
            shipment_provider: shipmentProvider,
          },
          'POST',
        );
        await this.invoke<unknown>(
          credentials,
          '/order/logistics/tracking/update',
          {
            order_item_ids: JSON.stringify(orderItemIds),
            tracking_number: trackingNumber,
            shipment_provider: shipmentProvider,
          },
          'POST',
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'fulfillOrder', error);
    }
  }
}
