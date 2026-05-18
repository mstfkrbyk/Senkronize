import { createHash } from 'node:crypto';
import { stringify } from 'node:querystring';

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

const ALIBABA_BASE = 'https://eco.taobao.com/router/rest';

function topMd5Sign(params: Record<string, string>, appSecret: string): string {
  const keys = Object.keys(params).filter((k) => k !== 'sign').sort();
  let s = appSecret;
  for (const k of keys) {
    s += `${k}${params[k]}`;
  }
  s += appSecret;
  return createHash('md5').update(s, 'utf8').digest('hex').toUpperCase();
}

function buildSignedBody(
  appKey: string,
  appSecret: string,
  sessionKey: string,
  method: string,
  extra: Record<string, string>,
): string {
  const params: Record<string, string> = {
    method,
    app_key: appKey,
    session: sessionKey,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    format: 'json',
    v: '2.0',
    sign_method: 'md5',
    ...extra,
  };
  params.sign = topMd5Sign(params, appSecret);
  return stringify(params);
}

@Injectable()
export class AlibabaAdapter implements IMarketplaceAdapter {
  readonly platform = 'ALIBABA';
  private readonly logger = new Logger(AlibabaAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.ALIBABA ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private requireCreds(credentials: Record<string, string>): {
    appKey: string;
    appSecret: string;
    sessionKey: string;
  } {
    const appKey = credentials.appKey?.trim();
    const appSecret = credentials.appSecret?.trim();
    const sessionKey = credentials.sessionKey?.trim();
    if (!appKey || !appSecret || !sessionKey) {
      throw new Error('Alibaba: appKey, appSecret ve sessionKey zorunludur');
    }
    return { appKey, appSecret, sessionKey };
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const o = row as StubRestOrder;
    const idRaw = o.id ?? o.order_id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const lines = o.lines ?? o.items ?? [];
    const createdRaw = o.created_at;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
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
      currency: typeof o.currency === 'string' ? o.currency : 'USD',
      createdAt,
      cargoTrackingNumber:
        typeof o.tracking_number === 'string' ? o.tracking_number : undefined,
      cargoProvider:
        typeof o.courier_name === 'string' ? o.courier_name : undefined,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { appKey, appSecret, sessionKey } = this.requireCreds(credentials);
      const body = buildSignedBody(appKey, appSecret, sessionKey, 'taobao.time.get', {});
      await withRateLimit('ALIBABA', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: ALIBABA_BASE,
            timeout: 12_000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: body,
          },
          { maxRetries: 1 },
        );
      });
      return true;
    } catch (error) {
      this.logger.warn('Alibaba bağlantı testi başarısız', {
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
      const { appKey, appSecret, sessionKey } = this.requireCreds(credentials);
      const sinceMs = since ? since.getTime() : undefined;
      let rows: MarketplaceOrder[] = [];
      await withRateLimit('ALIBABA', this.rpm(), async () => {
        const extra: Record<string, string> = {};
        if (sinceMs !== undefined) {
          extra.updated_since = new Date(sinceMs).toISOString();
        }
        const body = buildSignedBody(
          appKey,
          appSecret,
          sessionKey,
          'alibaba.open.stub.orders.list',
          extra,
        );
        const data = await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: ALIBABA_BASE,
            timeout: 20_000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: body,
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
      const { appKey, appSecret, sessionKey } = this.requireCreds(credentials);
      const { rows, total } = await withRateLimit('ALIBABA', this.rpm(), async () => {
        const body = buildSignedBody(appKey, appSecret, sessionKey, 'alibaba.open.stub.products.list', {
          page: String(page),
          page_size: '50',
        });
        const data = await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: ALIBABA_BASE,
            timeout: 20_000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: body,
          },
          {},
        );
        return normalizeProductRows(data);
      });
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const idRaw = p.id ?? p.sku;
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
      const { appKey, appSecret, sessionKey } = this.requireCreds(credentials);
      await withRateLimit('ALIBABA', this.rpm(), async () => {
        const body = buildSignedBody(appKey, appSecret, sessionKey, 'alibaba.open.stub.inventory.stock', {
          payload: JSON.stringify({
            items: updates.map((u) => ({ sku: u.barcode, qty: u.quantity })),
          }),
        });
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: ALIBABA_BASE,
            timeout: 20_000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: body,
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
      const { appKey, appSecret, sessionKey } = this.requireCreds(credentials);
      await withRateLimit('ALIBABA', this.rpm(), async () => {
        const body = buildSignedBody(appKey, appSecret, sessionKey, 'alibaba.open.stub.inventory.price', {
          payload: JSON.stringify({
            items: updates.map((u) => ({
              sku: u.barcode,
              sale_price: u.salePrice,
              list_price: u.listPrice,
            })),
          }),
        });
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: ALIBABA_BASE,
            timeout: 20_000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: body,
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }
}
