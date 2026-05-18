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
import type { GratisOrder, GratisOrderLine } from './gratis.types';

const GRATIS_BASE = 'https://api.gratis.com.tr/v1';
const PATH_ORDERS = '/orders';
const PATH_PRODUCTS = '/products';
const PATH_STOCK = '/inventory/stock';
const PATH_PRICE = '/inventory/price';

@Injectable()
export class GratisAdapter implements IMarketplaceAdapter {
  readonly platform = 'GRATIS';
  private readonly logger = new Logger(GratisAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.GRATIS ?? PLATFORM_RATE_LIMITS.DEFAULT;
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
      const url = `${GRATIS_BASE}/merchant/status`;
      await axiosWithRetry<unknown>(
        { method: 'GET', url, timeout: 12_000, ...this.headers(apiKey) },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Gratis bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const o = row as GratisOrder;
    const idRaw = o.id;
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
        : typeof o.customer === 'string'
          ? o.customer
          : '—';
    return {
      platformOrderId: String(idRaw),
      status: typeof o.status === 'string' ? o.status : 'NEW',
      customerName: name,
      items: lines.map((l: GratisOrderLine) => ({
        sku: typeof l.sku === 'string' ? l.sku : String(l.barcode ?? ''),
        barcode: typeof l.barcode === 'string' ? l.barcode : String(l.sku ?? ''),
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.price),
        platformItemId:
          l.line_id !== undefined && l.line_id !== null
            ? String(l.line_id)
            : String(l.sku ?? ''),
        productName: typeof l.name === 'string' ? l.name : undefined,
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
        throw new Error('Gratis: apiKey zorunludur');
      }
      const url = `${GRATIS_BASE}${PATH_ORDERS}`;
      const sinceMs = since ? since.getTime() : undefined;
      let rows: MarketplaceOrder[] = [];
      await withRateLimit('GRATIS', this.rpm(), async () => {
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
      throwSyncFailed('GRATIS', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Gratis: apiKey zorunludur');
      }
      const url = `${GRATIS_BASE}${PATH_PRODUCTS}`;
      const { rows, total } = await withRateLimit('GRATIS', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params: { page, limit: 50 },
            ...this.headers(apiKey),
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
        const titleRaw = p.title ?? barcode;
        const title =
          typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
        const sale = parseMoney(p.sale_price ?? p.price);
        const qtyRaw = p.stock ?? p.quantity ?? 0;
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
          listPrice: parseMoney(p.list_price ?? sale),
          approved: p.active !== false,
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
      throwSyncFailed('GRATIS', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Gratis: apiKey zorunludur');
      }
      const url = `${GRATIS_BASE}${PATH_STOCK}`;
      await withRateLimit('GRATIS', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url,
            timeout: 20_000,
            data: { updates: updates.map((u) => ({ barcode: u.barcode, qty: u.quantity })) },
            ...this.headers(apiKey),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('GRATIS', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Gratis: apiKey zorunludur');
      }
      const url = `${GRATIS_BASE}${PATH_PRICE}`;
      await withRateLimit('GRATIS', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url,
            timeout: 20_000,
            data: {
              updates: updates.map((u) => ({
                barcode: u.barcode,
                sale_price: u.salePrice,
                list_price: u.listPrice,
              })),
            },
            ...this.headers(apiKey),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('GRATIS', 'updatePrice', error);
    }
  }
}
