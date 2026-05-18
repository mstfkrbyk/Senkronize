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
import {
  isRecord,
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import type { StubRestOrder, StubRestOrderLine } from './rest-stub-marketplace.types';

export interface RestStubMarketplaceOptions {
  /** `IMarketplaceAdapter.platform` ve registry anahtarı */
  platform: string;
  /** Sabit taban URL; `resolveBaseUrl` tanımlıysa o önceliklidir */
  baseUrl: string;
  /** Kimlik bilgisine göre taban URL (örn. `{supplierId}` içeren Trendyol Yemek yolu) */
  resolveBaseUrl?: (credentials: Record<string, string>) => string;
  /** Nest `Logger` bağlamı (sınıf adı) */
  loggerContext: string;
  /** `PLATFORM_RATE_LIMITS` ve `withRateLimit` anahtarı */
  rateLimitKey: string;
  /** Bağlantı testi — placeholder endpoint */
  pathProfile: string;
  pathOrders: string;
  pathProducts: string;
  pathStock: string;
  pathPrice: string;
  resolveAuth: (
    credentials: Record<string, string>,
  ) => Promise<Pick<AxiosRequestConfig, 'headers' | 'auth' | 'params'>>;
}

/**
 * REST tabanlı pazaryeri adaptörleri için ortak stub uygulama.
 * Alt sınıflar `super(enc, options)` ile yapılandırır.
 */
export class RestStubMarketplaceAdapter implements IMarketplaceAdapter {
  readonly platform: string;
  private readonly logger: Logger;
  private readonly opts: RestStubMarketplaceOptions;

  constructor(
    encryptionService: EncryptionService,
    opts: RestStubMarketplaceOptions,
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

  private effectiveBase(credentials: Record<string, string>): string {
    const raw =
      this.opts.resolveBaseUrl !== undefined
        ? this.opts.resolveBaseUrl(credentials)
        : this.opts.baseUrl;
    return raw.trim().replace(/\/+$/, '');
  }

  private url(path: string, credentials: Record<string, string>): string {
    const base = this.effectiveBase(credentials);
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const auth = await this.opts.resolveAuth(credentials);
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: this.url(this.opts.pathProfile, credentials),
          timeout: 12_000,
          ...auth,
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn(`${this.opts.platform} bağlantı testi başarısız`, {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
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
      currency: typeof o.currency === 'string' ? o.currency : 'TRY',
      createdAt,
      cargoTrackingNumber:
        typeof o.tracking_number === 'string' ? o.tracking_number : undefined,
      cargoProvider:
        typeof o.courier_name === 'string' ? o.courier_name : undefined,
    };
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const auth = await this.opts.resolveAuth(credentials);
      const sinceMs = since ? since.getTime() : undefined;
      let rows: MarketplaceOrder[] = [];
      await withRateLimit(this.opts.rateLimitKey, this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: this.url(this.opts.pathOrders, credentials),
            timeout: 20_000,
            params:
              sinceMs !== undefined
                ? { updated_since: new Date(sinceMs).toISOString() }
                : undefined,
            ...auth,
          },
          {},
        );
        rows = normalizeOrdersRows(data)
          .map((r) => this.mapOrder(r))
          .filter((x): x is MarketplaceOrder => x !== null);
      });
      return rows;
    } catch (error) {
      throwSyncFailed(this.opts.platform, 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const auth = await this.opts.resolveAuth(credentials);
      const { rows, total } = await withRateLimit(
        this.opts.rateLimitKey,
        this.rpm(),
        async () => {
          const data = await axiosWithRetry<unknown>(
            {
              method: 'GET',
              url: this.url(this.opts.pathProducts, credentials),
              timeout: 20_000,
              params: { page, page_size: 50 },
              ...auth,
            },
            {},
          );
          return normalizeProductRows(data);
        },
      );
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
      throwSyncFailed(this.opts.platform, 'getListings', error);
    }
  }

  async getReturns(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<MarketplaceReturn[]> {
    return [];
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const auth = await this.opts.resolveAuth(credentials);
      await withRateLimit(this.opts.rateLimitKey, this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url: this.url(this.opts.pathStock),
            timeout: 20_000,
            data: {
              items: updates.map((u) => ({ sku: u.barcode, qty: u.quantity })),
            },
            ...auth,
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed(this.opts.platform, 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const auth = await this.opts.resolveAuth(credentials);
      await withRateLimit(this.opts.rateLimitKey, this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url: this.url(this.opts.pathPrice, credentials),
            timeout: 20_000,
            data: {
              items: updates.map((u) => ({
                sku: u.barcode,
                sale_price: u.salePrice,
                list_price: u.listPrice,
              })),
            },
            ...auth,
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed(this.opts.platform, 'updatePrice', error);
    }
  }
}
