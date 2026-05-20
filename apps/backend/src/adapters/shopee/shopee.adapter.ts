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
import {
  SHOPEE_ORDER_BATCH_SIZE,
  SHOPEE_ORDER_SYNC_STATUSES,
  SHOPEE_PARTNER_BASE,
} from './shopee.constants';
import { buildShopeeAuthorizeUrl, shopeeSign } from './shopee.oauth';

function unwrapShopeeResponse(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new Error('Shopee: geçersiz API yanıtı');
  }
  const err = data.error;
  if (typeof err === 'string' && err.length > 0) {
    const msg = typeof data.message === 'string' ? data.message : err;
    throw new Error(`Shopee: ${msg}`);
  }
  const inner = data.response;
  return isRecord(inner) ? inner : data;
}

@Injectable()
export class ShopeeAdapter implements IMarketplaceAdapter {
  readonly platform = 'SHOPEE';
  private readonly logger = new Logger(ShopeeAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  getAuthorizationUrl(
    credentials: Record<string, string>,
    redirectUri: string,
  ): string {
    const partnerId = credentials.partnerId?.trim() ?? '';
    const partnerKey =
      credentials.partnerKey?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.secretKey?.trim() ??
      '';
    if (!partnerId || !partnerKey) {
      throw new Error('Shopee: partnerId ve partnerKey zorunludur');
    }
    return buildShopeeAuthorizeUrl(partnerId, partnerKey, redirectUri);
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.SHOPEE ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private requireCreds(credentials: Record<string, string>): {
    partnerId: string;
    partnerKey: string;
    accessToken: string;
    shopId: string;
  } {
    const partnerId = credentials.partnerId?.trim();
    const partnerKey =
      credentials.partnerKey?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.secretKey?.trim();
    const accessToken = credentials.accessToken?.trim();
    const shopId = credentials.shopId?.trim();
    if (!partnerId || !partnerKey || !accessToken || !shopId) {
      throw new Error('Shopee: partnerId, partnerKey, accessToken ve shopId zorunludur');
    }
    return { partnerId, partnerKey, accessToken, shopId };
  }

  private signedQuery(
    credentials: Record<string, string>,
    path: string,
    withShopToken = true,
  ): {
    partner_id: string;
    timestamp: string;
    access_token?: string;
    shop_id?: string;
    sign: string;
  } {
    const { partnerId, partnerKey, accessToken, shopId } = this.requireCreds(credentials);
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = withShopToken
      ? shopeeSign(path, timestamp, partnerId, partnerKey, accessToken, shopId)
      : shopeeSign(path, timestamp, partnerId, partnerKey);
    const base = {
      partner_id: partnerId,
      timestamp: String(timestamp),
      sign,
    };
    if (withShopToken) {
      return {
        ...base,
        access_token: accessToken,
        shop_id: shopId,
      };
    }
    return base;
  }

  private async get<T>(
    credentials: Record<string, string>,
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const query = { ...this.signedQuery(credentials, path), ...params };
    const data = await axiosWithRetry<unknown>(
      {
        method: 'GET',
        url: `${SHOPEE_PARTNER_BASE}${path}`,
        timeout: 25_000,
        params: query,
      },
      {},
    );
    return unwrapShopeeResponse(data) as T;
  }

  private async post<T>(
    credentials: Record<string, string>,
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const query = this.signedQuery(credentials, path);
    const data = await axiosWithRetry<unknown>(
      {
        method: 'POST',
        url: `${SHOPEE_PARTNER_BASE}${path}`,
        timeout: 25_000,
        params: query,
        headers: { 'Content-Type': 'application/json' },
        data: body,
      },
      {},
    );
    return unwrapShopeeResponse(data) as T;
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const idRaw = row.order_sn ?? row.order_id ?? row.id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const lines = row.item_list ?? row.lines ?? row.items ?? [];
    const createdRaw = row.create_time ?? row.created_at;
    const createdAt =
      typeof createdRaw === 'number' && Number.isFinite(createdRaw)
        ? new Date(createdRaw * 1000).toISOString()
        : typeof createdRaw === 'string' && createdRaw.length > 0
          ? new Date(createdRaw).toISOString()
          : new Date().toISOString();
    const recipient = isRecord(row.recipient_address) ? row.recipient_address : null;
    const name =
      typeof row.buyer_username === 'string' && row.buyer_username.length > 0
        ? row.buyer_username
        : recipient && typeof recipient.name === 'string'
          ? recipient.name
          : '—';
    const lineArr = Array.isArray(lines) ? lines : [];
    return {
      platformOrderId: String(idRaw),
      status: typeof row.order_status === 'string' ? row.order_status : 'NEW',
      customerName: name,
      items: lineArr.filter(isRecord).map((line) => ({
        sku: typeof line.model_sku === 'string' ? line.model_sku : String(line.item_sku ?? ''),
        barcode:
          typeof line.item_sku === 'string'
            ? line.item_sku
            : String(line.model_sku ?? line.item_id ?? ''),
        quantity:
          typeof line.model_quantity_purchased === 'number' &&
          Number.isFinite(line.model_quantity_purchased)
            ? Math.max(0, Math.round(line.model_quantity_purchased))
            : typeof line.quantity === 'number' && Number.isFinite(line.quantity)
              ? Math.max(0, Math.round(line.quantity))
              : 0,
        unitPrice: parseMoney(
          line.model_discounted_price ?? line.model_original_price ?? line.unit_price,
        ),
        platformItemId:
          line.order_item_id !== undefined && line.order_item_id !== null
            ? String(line.order_item_id)
            : line.item_id !== undefined && line.item_id !== null
              ? String(line.item_id)
              : String(line.model_id ?? ''),
        productName:
          typeof line.item_name === 'string'
            ? line.item_name
            : typeof line.product_name === 'string'
              ? line.product_name
              : undefined,
      })),
      totalAmount: parseMoney(row.total_amount ?? row.escrow_amount),
      currency: typeof row.currency === 'string' ? row.currency : 'MYR',
      createdAt,
      cargoTrackingNumber:
        typeof row.tracking_number === 'string' ? row.tracking_number : undefined,
      cargoProvider:
        typeof row.shipping_carrier === 'string' ? row.shipping_carrier : undefined,
    };
  }

  private async collectOrderSns(
    credentials: Record<string, string>,
    timeRangeField: 'create_time' | 'update_time',
    timeFrom: number,
    timeTo: number,
    orderStatus: string,
  ): Promise<string[]> {
    const orderSns: string[] = [];
    let cursor = '';
    for (;;) {
      const params: Record<string, string> = {
        time_range_field: timeRangeField,
        time_from: String(timeFrom),
        time_to: String(timeTo),
        page_size: String(SHOPEE_ORDER_BATCH_SIZE),
        order_status: orderStatus,
      };
      if (cursor.length > 0) {
        params.cursor = cursor;
      }
      const listPage = await withRateLimit('SHOPEE', this.rpm(), async () =>
        this.get<Record<string, unknown>>(
          credentials,
          '/api/v2/order/get_order_list',
          params,
        ),
      );
      const list = Array.isArray(listPage.order_list) ? listPage.order_list : [];
      for (const entry of list) {
        if (isRecord(entry) && typeof entry.order_sn === 'string') {
          orderSns.push(entry.order_sn);
        }
      }
      const more = listPage.more === true;
      const next = typeof listPage.next_cursor === 'string' ? listPage.next_cursor : '';
      if (!more || next.length === 0) {
        break;
      }
      cursor = next;
    }
    return orderSns;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await withRateLimit('SHOPEE', this.rpm(), async () => {
        await this.get<unknown>(credentials, '/api/v2/shop/get_shop_info');
      });
      return true;
    } catch (error) {
      this.logger.warn('Shopee bağlantı testi başarısız', {
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
      const now = Math.floor(Date.now() / 1000);
      const timeFrom = since
        ? Math.floor(since.getTime() / 1000)
        : now - 7 * 24 * 3600;
      const orderSnSet = new Set<string>();

      for (const timeRangeField of ['create_time', 'update_time'] as const) {
        for (const orderStatus of SHOPEE_ORDER_SYNC_STATUSES) {
          const sns = await this.collectOrderSns(
            credentials,
            timeRangeField,
            timeFrom,
            now,
            orderStatus,
          );
          for (const sn of sns) {
            orderSnSet.add(sn);
          }
        }
      }

      const orderSns = [...orderSnSet];
      if (orderSns.length === 0) {
        return [];
      }

      const orders: MarketplaceOrder[] = [];
      for (let i = 0; i < orderSns.length; i += SHOPEE_ORDER_BATCH_SIZE) {
        const chunk = orderSns.slice(i, i + SHOPEE_ORDER_BATCH_SIZE);
        const detail = await withRateLimit('SHOPEE', this.rpm(), async () =>
          this.get<Record<string, unknown>>(credentials, '/api/v2/order/get_order_detail', {
            order_sn_list: chunk.join(','),
          }),
        );
        const detailList = Array.isArray(detail.order_list) ? detail.order_list : [];
        for (const row of detailList) {
          const mapped = this.mapOrder(row);
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
      const data = await withRateLimit('SHOPEE', this.rpm(), async () =>
        this.get<unknown>(credentials, '/api/v2/product/get_item_list', {
          offset: String(page * 50),
          page_size: '50',
        }),
      );
      const { rows, total } = normalizeProductRows(data);
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const idRaw = p.item_id ?? p.id ?? p.sku;
        const id =
          idRaw !== undefined && idRaw !== null ? String(idRaw) : `row-${i}`;
        const barcode =
          typeof p.item_sku === 'string'
            ? p.item_sku
            : typeof p.sku === 'string'
              ? p.sku
              : id;
        const titleRaw = p.item_name ?? p.title ?? p.name ?? barcode;
        const title =
          typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
        const priceInfo = isRecord(p.price_info) ? p.price_info : null;
        const stockInfo = isRecord(p.stock_info) ? p.stock_info : null;
        const sale = parseMoney(
          priceInfo?.current_price ?? priceInfo?.original_price ?? p.sale_price ?? p.price,
        );
        const qtyRaw = stockInfo?.current_stock ?? p.stock ?? p.quantity ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        const images: string[] = [];
        if (Array.isArray(p.image)) {
          for (const im of p.image) {
            if (typeof im === 'string') {
              images.push(im);
            } else if (isRecord(im) && typeof im.image_url === 'string') {
              images.push(im.image_url);
            }
          }
        }
        return {
          platformProductId: id,
          barcode,
          title,
          quantity,
          salePrice: sale,
          listPrice: parseMoney(priceInfo?.original_price ?? sale),
          approved: p.item_status !== 'UNLIST',
          images,
        };
      });
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize: 50,
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
      const stock_list = updates.map((u) => ({
        model_id: 0,
        item_id: Number.parseInt(u.barcode, 10) || u.barcode,
        normal_stock: u.quantity,
      }));
      await withRateLimit('SHOPEE', this.rpm(), async () => {
        await this.post<unknown>(credentials, '/api/v2/product/update_stock', {
          stock_list,
        });
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
      for (const u of updates) {
        const item_id = Number.parseInt(u.barcode, 10) || u.barcode;
        await withRateLimit('SHOPEE', this.rpm(), async () => {
          await this.post<unknown>(credentials, '/api/v2/product/update_price', {
            item_id,
            price_list: [{ model_id: 0, original_price: u.salePrice }],
          });
        });
      }
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }

  /** Kargo bildirimi — POST /logistics/init */
  async initLogistics(
    credentials: Record<string, string>,
    orderSn: string,
    trackingNo: string,
    logisticsChannelId: number,
    packageNumber = '',
  ): Promise<void> {
    try {
      await withRateLimit('SHOPEE', this.rpm(), async () => {
        await this.post<unknown>(credentials, '/api/v2/logistics/init', {
          order_sn: orderSn,
          package_number: packageNumber,
          tracking_no: trackingNo,
          logistics_channel_id: logisticsChannelId,
        });
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'initLogistics', error);
    }
  }
}
