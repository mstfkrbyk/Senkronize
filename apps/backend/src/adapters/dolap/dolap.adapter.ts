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
import type { DolapOrder, DolapOrderLine } from './dolap.types';

const DOLAP_BASE = 'https://api.dolap.com/v1';
const PATH_LISTINGS = '/listings';
const PATH_ORDERS = '/orders';
const PATH_STOCK = '/listings/stock';

@Injectable()
export class DolapAdapter implements IMarketplaceAdapter {
  readonly platform = 'DOLAP';
  private readonly logger = new Logger(DolapAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.DOLAP ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private auth(token: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const token = credentials.accessToken?.trim();
      if (!token) {
        return false;
      }
      const url = `${DOLAP_BASE}/me`;
      await axiosWithRetry<unknown>(
        { method: 'GET', url, timeout: 12_000, ...this.auth(token) },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Dolap bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const o = row as DolapOrder;
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
    const name =
      typeof o.buyer_username === 'string' && o.buyer_username.length > 0
        ? o.buyer_username
        : '—';
    return {
      platformOrderId: String(idRaw),
      status: typeof o.status === 'string' ? o.status : 'NEW',
      customerName: name,
      items: lines.map((l: DolapOrderLine) => ({
        sku: typeof l.sku === 'string' ? l.sku : String(l.listing_id ?? ''),
        barcode: String(l.listing_id ?? l.sku ?? ''),
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.price),
        platformItemId:
          l.listing_id !== undefined && l.listing_id !== null
            ? String(l.listing_id)
            : String(l.sku ?? ''),
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
      const token = credentials.accessToken?.trim();
      if (!token) {
        throw new Error('Dolap: accessToken zorunludur');
      }
      const url = `${DOLAP_BASE}${PATH_ORDERS}`;
      const sinceMs = since ? since.getTime() : undefined;
      let rows: MarketplaceOrder[] = [];
      await withRateLimit('DOLAP', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params:
              sinceMs !== undefined
                ? { since: new Date(sinceMs).toISOString() }
                : undefined,
            ...this.auth(token),
          },
          {},
        );
        rows = normalizeOrdersRows(data)
          .map((r) => this.mapOrder(r))
          .filter((x): x is MarketplaceOrder => x !== null);
      });
      return rows;
    } catch (error) {
      throwSyncFailed('DOLAP', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const token = credentials.accessToken?.trim();
      if (!token) {
        throw new Error('Dolap: accessToken zorunludur');
      }
      const url = `${DOLAP_BASE}${PATH_LISTINGS}`;
      const { rows, total } = await withRateLimit('DOLAP', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params: { page, limit: 50 },
            ...this.auth(token),
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
          typeof p.sku === 'string' ? p.sku : typeof p.id !== 'undefined' ? String(p.id) : id;
        const titleRaw = p.title ?? barcode;
        const title =
          typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
        const sale = parseMoney(p.price);
        const qtyRaw = p.stock ?? 0;
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
          listPrice: sale,
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
      throwSyncFailed('DOLAP', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const token = credentials.accessToken?.trim();
      if (!token) {
        throw new Error('Dolap: accessToken zorunludur');
      }
      const url = `${DOLAP_BASE}${PATH_STOCK}`;
      await withRateLimit('DOLAP', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url,
            timeout: 20_000,
            data: { updates: updates.map((u) => ({ listing_id: u.barcode, stock: u.quantity })) },
            ...this.auth(token),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('DOLAP', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const token = credentials.accessToken?.trim();
      if (!token) {
        throw new Error('Dolap: accessToken zorunludur');
      }
      const url = `${DOLAP_BASE}/listings/price`;
      await withRateLimit('DOLAP', this.rpm(), async () => {
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
            ...this.auth(token),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('DOLAP', 'updatePrice', error);
    }
  }
}
