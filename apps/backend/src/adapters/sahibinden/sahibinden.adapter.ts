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
import type {
  SahibindenOrder,
  SahibindenOrderLine,
} from './sahibinden.types';

const PATH_LISTINGS = '/listings';
const PATH_ORDERS = '/orders';
const PATH_STOCK = '/listings/stock';
const PATH_PRICE = '/listings/price';

@Injectable()
export class SahibindenAdapter implements IMarketplaceAdapter {
  readonly platform: string = 'SAHIBINDEN';
  private readonly logger = new Logger(SahibindenAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  /** Alt kanallar (Premium vb.) base URL override eder */
  protected sahibindenBaseUrl(): string {
    return 'https://api.sahibinden.com/v1';
  }

  protected rateLimitKey(): string {
    return this.platform;
  }

  private rpm(): number {
    return (
      PLATFORM_RATE_LIMITS[this.rateLimitKey()] ?? PLATFORM_RATE_LIMITS.DEFAULT
    );
  }

  private headers(apiKey: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        'X-API-Key': apiKey,
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
      const url = `${this.sahibindenBaseUrl()}/merchant/me`;
      await axiosWithRetry<unknown>(
        { method: 'GET', url, timeout: 12_000, ...this.headers(apiKey) },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Sahibinden bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const o = row as SahibindenOrder;
    const idRaw = o.id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const lines = o.lines ?? [];
    const createdRaw = o.created_at;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const name = typeof o.buyer === 'string' && o.buyer.length > 0 ? o.buyer : '—';
    return {
      platformOrderId: String(idRaw),
      status: typeof o.status === 'string' ? o.status : 'NEW',
      customerName: name,
      items: lines.map((l: SahibindenOrderLine) => ({
        sku: String(l.listing_id ?? ''),
        barcode: String(l.listing_id ?? ''),
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.price),
        platformItemId:
          l.listing_id !== undefined && l.listing_id !== null
            ? String(l.listing_id)
            : '',
        productName: typeof l.title === 'string' ? l.title : undefined,
      })),
      totalAmount: parseMoney(o.total),
      currency: typeof o.currency === 'string' ? o.currency : 'TRY',
      createdAt,
    };
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Sahibinden: apiKey zorunludur');
      }
      const url = `${this.sahibindenBaseUrl()}${PATH_ORDERS}`;
      const sinceMs = since ? since.getTime() : undefined;
      let rows: MarketplaceOrder[] = [];
      await withRateLimit(this.rateLimitKey(), this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params:
              sinceMs !== undefined
                ? { since: new Date(sinceMs).toISOString() }
                : undefined,
            ...this.headers(apiKey),
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
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Sahibinden: apiKey zorunludur');
      }
      const url = `${this.sahibindenBaseUrl()}${PATH_LISTINGS}`;
      const { rows, total } = await withRateLimit(this.rateLimitKey(), this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params: { page, size: 50 },
            ...this.headers(apiKey),
          },
          {},
        );
        return normalizeProductRows(data);
      });
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const idRaw = p.id ?? p.listing_id;
        const id =
          idRaw !== undefined && idRaw !== null ? String(idRaw) : `row-${i}`;
        const barcode =
          typeof p.sku === 'string' && p.sku.length > 0 ? p.sku : id;
        const titleRaw = p.title ?? barcode;
        const title =
          typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
        const sale = parseMoney(p.price);
        const qtyRaw = p.stock ?? p.quantity ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        const statusStr =
          typeof p.status === 'string' ? p.status.toUpperCase() : 'ACTIVE';
        return {
          platformProductId: id,
          barcode,
          title,
          quantity,
          salePrice: sale,
          listPrice: sale,
          approved: statusStr === 'ACTIVE' || statusStr === 'PUBLISHED',
          images: [],
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
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Sahibinden: apiKey zorunludur');
      }
      const url = `${this.sahibindenBaseUrl()}${PATH_STOCK}`;
      await withRateLimit(this.rateLimitKey(), this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url,
            timeout: 20_000,
            data: {
              updates: updates.map((u) => ({
                listing_id: u.barcode,
                stock: u.quantity,
              })),
            },
            ...this.headers(apiKey),
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
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Sahibinden: apiKey zorunludur');
      }
      const url = `${this.sahibindenBaseUrl()}${PATH_PRICE}`;
      await withRateLimit(this.rateLimitKey(), this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url,
            timeout: 20_000,
            data: {
              updates: updates.map((u) => ({
                listing_id: u.barcode,
                price: u.salePrice,
              })),
            },
            ...this.headers(apiKey),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }
}
