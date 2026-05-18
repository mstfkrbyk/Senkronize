import { createHmac } from 'node:crypto';

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
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import type { StubRestOrder, StubRestOrderLine } from '../internal/rest-stub-marketplace.types';

const SHOPEE_BASE = 'https://partner.shopeemobile.com';

function shopeeSign(
  partnerKey: string,
  partnerId: string,
  path: string,
  timestamp: number,
  accessToken: string,
  shopId: string,
): string {
  const base = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return createHmac('sha256', partnerKey).update(base, 'utf8').digest('hex');
}

@Injectable()
export class ShopeeAdapter implements IMarketplaceAdapter {
  readonly platform = 'SHOPEE';
  private readonly logger = new Logger(ShopeeAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
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
    const partnerKey = credentials.partnerKey?.trim();
    const accessToken = credentials.accessToken?.trim();
    const shopId = credentials.shopId?.trim();
    if (!partnerId || !partnerKey || !accessToken || !shopId) {
      throw new Error('Shopee: partnerId, partnerKey, accessToken ve shopId zorunludur');
    }
    return { partnerId, partnerKey, accessToken, shopId };
  }

  private signedParams(
    credentials: Record<string, string>,
    path: string,
    extra: Record<string, string>,
  ): Record<string, string> {
    const { partnerId, partnerKey, accessToken, shopId } = this.requireCreds(credentials);
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = shopeeSign(partnerKey, partnerId, path, timestamp, accessToken, shopId);
    return {
      partner_id: partnerId,
      timestamp: String(timestamp),
      access_token: accessToken,
      shop_id: shopId,
      sign,
      ...extra,
    };
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const o = row as StubRestOrder;
    const idRaw = o.id ?? o.order_id ?? o.order_sn;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const lines = o.lines ?? o.items ?? [];
    const createdRaw = o.created_at ?? o.create_time;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : typeof createdRaw === 'number' && Number.isFinite(createdRaw)
          ? new Date(createdRaw * 1000).toISOString()
          : new Date().toISOString();
    const name =
      typeof o.customer_name === 'string' && o.customer_name.length > 0
        ? o.customer_name
        : typeof o.buyer_username === 'string' && o.buyer_username.length > 0
          ? o.buyer_username
          : '—';
    return {
      platformOrderId: String(idRaw),
      status: typeof o.status === 'string' ? o.status : 'NEW',
      customerName: name,
      items: lines.map((l: StubRestOrderLine) => ({
        sku: typeof l.sku === 'string' ? l.sku : String(l.barcode ?? ''),
        barcode: typeof l.barcode === 'string' ? l.barcode : String(l.sku ?? ''),
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.unit_price ?? l.price),
        platformItemId:
          l.id !== undefined && l.id !== null ? String(l.id) : String(l.sku ?? ''),
        productName:
          typeof l.product_name === 'string'
            ? l.product_name
            : typeof l.title === 'string'
              ? l.title
              : undefined,
      })),
      totalAmount: parseMoney(o.total_amount ?? o.total),
      currency: typeof o.currency === 'string' ? o.currency : 'MYR',
      createdAt,
      cargoTrackingNumber:
        typeof o.tracking_number === 'string' ? o.tracking_number : undefined,
      cargoProvider:
        typeof o.courier_name === 'string' ? o.courier_name : undefined,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const path = '/api/v2/shop/get_shop_info';
      const params = this.signedParams(credentials, path, {});
      await withRateLimit('SHOPEE', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${SHOPEE_BASE}${path}`,
            timeout: 12_000,
            params,
          },
          { maxRetries: 1 },
        );
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
      const path = '/api/v2/order/get_order_list';
      const extra: Record<string, string> = {};
      if (since) {
        extra.time_from = String(Math.floor(since.getTime() / 1000));
      }
      const params = this.signedParams(credentials, path, extra);
      let rows: MarketplaceOrder[] = [];
      await withRateLimit('SHOPEE', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${SHOPEE_BASE}${path}`,
            timeout: 20_000,
            params,
          },
          {},
        );
        rows = normalizeOrdersRows(data)
          .map((r) => this.mapOrder(r))
          .filter((x): x is MarketplaceOrder => x !== null);
      });
      return rows;
    } catch (error) {
      throwSyncFailed(this.platform, 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const path = '/api/v2/product/get_item_list';
      const params = this.signedParams(credentials, path, {
        offset: String(page * 50),
        page_size: '50',
      });
      const { rows, total } = await withRateLimit('SHOPEE', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${SHOPEE_BASE}${path}`,
            timeout: 20_000,
            params,
          },
          {},
        );
        return normalizeProductRows(data);
      });
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const idRaw = p.item_id ?? p.id ?? p.sku;
        const id =
          idRaw !== undefined && idRaw !== null ? String(idRaw) : `row-${i}`;
        const barcode =
          typeof p.barcode === 'string'
            ? p.barcode
            : typeof p.sku === 'string'
              ? p.sku
              : id;
        const titleRaw = p.title ?? p.name ?? barcode;
        const title =
          typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
        const sale = parseMoney(p.sale_price ?? p.price);
        const qtyRaw = p.stock ?? p.quantity ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        const images: string[] = [];
        if (Array.isArray(p.images)) {
          for (const im of p.images) {
            if (typeof im === 'string') {
              images.push(im);
            } else if (isRecord(im) && typeof im.url === 'string') {
              images.push(im.url);
            }
          }
        }
        return {
          platformProductId: id,
          barcode,
          title,
          quantity,
          salePrice: sale,
          listPrice: parseMoney(p.list_price ?? sale),
          approved: p.active !== false,
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
      const path = '/api/v2/product/update_stock';
      const params = this.signedParams(credentials, path, {
        stock_list: JSON.stringify(
          updates.map((u) => ({ item_sku: u.barcode, stock: u.quantity })),
        ),
      });
      await withRateLimit('SHOPEE', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${SHOPEE_BASE}${path}`,
            timeout: 20_000,
            params,
          },
          {},
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
      const path = '/api/v2/product/update_price';
      const params = this.signedParams(credentials, path, {
        price_list: JSON.stringify(
          updates.map((u) => ({
            item_sku: u.barcode,
            price: u.salePrice,
            original_price: u.listPrice,
          })),
        ),
      });
      await withRateLimit('SHOPEE', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${SHOPEE_BASE}${path}`,
            timeout: 20_000,
            params,
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }
}
