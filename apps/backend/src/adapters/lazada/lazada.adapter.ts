import { Injectable, Logger } from '@nestjs/common';
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
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import { LAZADA_ORDER_BATCH_SIZE } from './lazada.constants';
import { buildLazadaAuthorizeUrl, lazadaBusinessApiBase, lazadaSign } from './lazada.oauth';

function unwrapLazadaData(data: unknown): unknown {
  if (!isRecord(data)) {
    return data;
  }
  const code = data.code;
  if (code !== undefined && code !== '0' && code !== 0) {
    const msg = typeof data.message === 'string' ? data.message : 'Lazada API hatası';
    throw new Error(msg);
  }
  return data.data ?? data;
}

@Injectable()
export class LazadaAdapter implements IMarketplaceAdapter {
  readonly platform = 'LAZADA';
  private readonly logger = new Logger(LazadaAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  getAuthorizationUrl(
    credentials: Record<string, string>,
    state: string,
    redirectUri: string,
  ): string {
    const appKey = credentials.appKey?.trim() ?? credentials.apiKey?.trim() ?? '';
    if (!appKey) {
      throw new Error('Lazada: appKey zorunludur');
    }
    return buildLazadaAuthorizeUrl(appKey, redirectUri, state);
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.LAZADA ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private requireCreds(credentials: Record<string, string>): {
    appKey: string;
    appSecret: string;
    accessToken: string;
  } {
    const appKey = credentials.appKey?.trim() ?? credentials.apiKey?.trim();
    const appSecret =
      credentials.appSecret?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.secretKey?.trim();
    const accessToken = credentials.accessToken?.trim();
    if (!appKey || !appSecret || !accessToken) {
      throw new Error('Lazada: appKey, appSecret ve accessToken zorunludur');
    }
    return { appKey, appSecret, accessToken };
  }

  private apiBase(credentials: Record<string, string>): string {
    return lazadaBusinessApiBase(credentials);
  }

  private async invoke<T>(
    credentials: Record<string, string>,
    apiName: string,
    params: Record<string, string> = {},
    method: 'GET' | 'POST' = 'GET',
  ): Promise<T> {
    const { appKey, appSecret, accessToken } = this.requireCreds(credentials);
    const timestamp = String(Date.now());
    const signParams: Record<string, string> = {
      app_key: appKey,
      access_token: accessToken,
      sign_method: 'sha256',
      timestamp,
      ...params,
    };
    const sign = lazadaSign(apiName, signParams, appSecret);
    const data = await axiosWithRetry<unknown>(
      {
        method,
        url: `${this.apiBase(credentials)}${apiName}`,
        timeout: 25_000,
        params: { ...signParams, sign },
      },
      {},
    );
    return unwrapLazadaData(data) as T;
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
        sku: typeof l.sku === 'string' ? l.sku : String(l.shop_sku ?? ''),
        barcode: typeof l.shop_sku === 'string' ? l.shop_sku : String(l.sku ?? ''),
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
      currency: typeof row.currency === 'string' ? row.currency : 'MYR',
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
      await withRateLimit('LAZADA', this.rpm(), async () => {
        await this.invoke<unknown>(credentials, '/seller/get');
      });
      return true;
    } catch (error) {
      this.logger.warn('Lazada bağlantı testi başarısız', {
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
          const page = await withRateLimit('LAZADA', this.rpm(), async () =>
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
      for (let i = 0; i < orderIds.length; i += LAZADA_ORDER_BATCH_SIZE) {
        const chunk = orderIds.slice(i, i + LAZADA_ORDER_BATCH_SIZE);
        const detailPage = await withRateLimit('LAZADA', this.rpm(), async () =>
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
          const itemsData = await withRateLimit('LAZADA', this.rpm(), async () =>
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

  async registerWebhook(
    credentials: Record<string, string>,
    callbackUrl: string,
  ): Promise<void> {
    await withRateLimit('LAZADA', this.rpm(), async () => {
      await this.invoke<unknown>(
        credentials,
        '/api/webhook/create',
        { url: callbackUrl },
        'POST',
      );
    });
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const limit = 50;
      const offset = page * limit;
      const data = await withRateLimit('LAZADA', this.rpm(), async () =>
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

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const skus = updates.map((u) => ({
        SkuId: u.barcode,
        quantity: u.quantity,
      }));
      await withRateLimit('LAZADA', this.rpm(), async () => {
        await this.invoke<unknown>(
          credentials,
          '/products/update',
          { payload: JSON.stringify({ skus }) },
          'POST',
        );
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
      const skus = updates.map((u) => ({
        SkuId: u.barcode,
        price: u.salePrice,
      }));
      await withRateLimit('LAZADA', this.rpm(), async () => {
        await this.invoke<unknown>(
          credentials,
          '/products/update',
          { payload: JSON.stringify({ skus }) },
          'POST',
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }

  /** Kargo bildirimi — POST /order/fulfill */
  async fulfillOrder(
    credentials: Record<string, string>,
    orderItemIds: string[],
    shipmentProvider: string,
    trackingNumber: string,
  ): Promise<void> {
    try {
      await withRateLimit('LAZADA', this.rpm(), async () => {
        await this.invoke<unknown>(
          credentials,
          '/order/fulfill',
          {
            order_item_ids: JSON.stringify(orderItemIds),
            shipment_provider: shipmentProvider,
            tracking_number: trackingNumber,
          },
          'POST',
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'fulfillOrder', error);
    }
  }
}
