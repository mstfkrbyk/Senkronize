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
import type { MorhipoOrder, MorhipoOrderLine } from './morhipo.types';

const MORHIPO_BASE = 'https://api.morhipo.com/marketplace/v2';
const PATH_CAMPAIGN_ORDERS = '/campaigns/orders';
const PATH_INVENTORY = '/inventory/stock';

@Injectable()
export class MorhipoAdapter implements IMarketplaceAdapter {
  readonly platform = 'MORHIPO';
  private readonly logger = new Logger(MorhipoAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.MORHIPO ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private headers(apiKey: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      const url = `${MORHIPO_BASE}/merchant/ping`;
      await axiosWithRetry<unknown>(
        { method: 'GET', url, timeout: 12_000, ...this.headers(apiKey) },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Morhipo bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const o = row as MorhipoOrder;
    const idRaw = o.id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const lines = Array.isArray(o.lines) ? o.lines : [];
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
      items: lines.map((l: MorhipoOrderLine) => {
        const qty = l.qty ?? l.quantity ?? 0;
        return {
          sku: typeof l.sku === 'string' ? l.sku : String(l.barcode ?? ''),
          barcode: typeof l.barcode === 'string' ? l.barcode : String(l.sku ?? ''),
          quantity:
            typeof qty === 'number' && Number.isFinite(qty)
              ? Math.max(0, Math.round(qty))
              : 0,
          unitPrice: parseMoney(l.price),
          platformItemId:
            l.id !== undefined && l.id !== null ? String(l.id) : String(l.sku ?? ''),
          productName: typeof l.title === 'string' ? l.title : undefined,
        };
      }),
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
        throw new Error('Morhipo: apiKey zorunludur');
      }
      const url = `${MORHIPO_BASE}${PATH_CAMPAIGN_ORDERS}`;
      const sinceMs = since ? since.getTime() : undefined;
      let rows: MarketplaceOrder[] = [];
      await withRateLimit('MORHIPO', this.rpm(), async () => {
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
      throwSyncFailed('MORHIPO', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Morhipo: apiKey zorunludur');
      }
      const url = `${MORHIPO_BASE}/campaigns/products`;
      const { rows, total } = await withRateLimit('MORHIPO', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params: { page, pageSize: 50 },
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
        const sale = parseMoney(p.price ?? p.sale_price);
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
          approved: true,
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
      throwSyncFailed('MORHIPO', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Morhipo: apiKey zorunludur');
      }
      const url = `${MORHIPO_BASE}${PATH_INVENTORY}`;
      await withRateLimit('MORHIPO', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url,
            timeout: 20_000,
            data: { stock_updates: updates.map((u) => ({ sku: u.barcode, stock: u.quantity })) },
            ...this.headers(apiKey),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('MORHIPO', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const apiKey = credentials.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Morhipo: apiKey zorunludur');
      }
      const url = `${MORHIPO_BASE}/inventory/price`;
      await withRateLimit('MORHIPO', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url,
            timeout: 20_000,
            data: {
              price_updates: updates.map((u) => ({
                sku: u.barcode,
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
      throwSyncFailed('MORHIPO', 'updatePrice', error);
    }
  }
}
