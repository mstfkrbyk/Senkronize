import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, type AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  isRecord,
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
} from '../stub-helpers';
import {
  DOLAP_API_BASE,
  DOLAP_FIXED_STOCK,
  DOLAP_LISTINGS_PATH,
  DOLAP_LISTING_STATUS_ACTIVE,
  DOLAP_ORDERS_PATH,
  DOLAP_ORDER_STATUS_NEW,
} from './dolap.constants';
import type { DolapOrder, DolapOrderLine, DolapShipPayload } from './dolap.types';

@Injectable()
export class DolapAdapter implements IMarketplaceAdapter {
  readonly platform = 'DOLAP';
  private readonly logger = new Logger(DolapAdapter.name);

  private resolveApiKey(credentials: Record<string, string>): string {
    const apiKey =
      credentials.apiKey?.trim() ??
      credentials.accessToken?.trim() ??
      credentials.token?.trim();
    if (!apiKey) {
      throw new Error('Dolap: apiKey zorunludur');
    }
    return apiKey;
  }

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = this.resolveApiKey(credentials);
    return axios.create({
      baseURL: DOLAP_API_BASE,
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 20_000,
    });
  }

  private toApiError(error: unknown, label: string): Error {
    if (axios.isAxiosError(error)) {
      const ax = error as AxiosError<{ message?: string; error?: string }>;
      const status = ax.response?.status;
      const body = ax.response?.data;
      const detail =
        typeof body === 'object' && body !== null
          ? (typeof body.message === 'string'
              ? body.message
              : typeof body.error === 'string'
                ? body.error
                : ax.message)
          : ax.message;
      return new Error(
        `${label}${status != null ? ` (${String(status)})` : ''}: ${detail}`,
      );
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(`${label}: istek başarısız`);
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = this.getClient(credentials);
      await client.get(DOLAP_LISTINGS_PATH, {
        params: {
          page: 0,
          status: DOLAP_LISTING_STATUS_ACTIVE,
          limit: 1,
        },
      });
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
      status: typeof o.status === 'string' ? o.status : DOLAP_ORDER_STATUS_NEW,
      customerName: name,
      items: lines.map((l: DolapOrderLine) => ({
        sku: typeof l.sku === 'string' ? l.sku : String(l.listing_id ?? ''),
        barcode: String(l.listing_id ?? l.sku ?? ''),
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : DOLAP_FIXED_STOCK,
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
    const client = this.getClient(credentials);
    const all: MarketplaceOrder[] = [];
    let page = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      let data: unknown;
      try {
        const res = await client.get<unknown>(DOLAP_ORDERS_PATH, {
          params: {
            status: DOLAP_ORDER_STATUS_NEW,
            page,
            limit,
          },
        });
        data = res.data;
      } catch (error) {
        throw this.toApiError(error, 'Dolap sipariş');
      }

      const rows = normalizeOrdersRows(data)
        .map((r) => this.mapOrder(r))
        .filter((x): x is MarketplaceOrder => x !== null);

      for (const order of rows) {
        if (since && new Date(order.createdAt).getTime() < since.getTime()) {
          continue;
        }
        all.push(order);
      }

      if (isRecord(data)) {
        const totalRaw = data.totalCount ?? data.total;
        const total =
          typeof totalRaw === 'number' && Number.isFinite(totalRaw)
            ? totalRaw
            : undefined;
        if (typeof total === 'number') {
          hasMore = (page + 1) * limit < total;
        } else {
          hasMore = rows.length >= limit;
        }
      } else {
        hasMore = rows.length >= limit;
      }
      page += 1;
    }

    return all;
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const client = this.getClient(credentials);
    let data: unknown;
    try {
      const res = await client.get<unknown>(DOLAP_LISTINGS_PATH, {
        params: {
          page,
          status: DOLAP_LISTING_STATUS_ACTIVE,
          limit: 50,
        },
      });
      data = res.data;
    } catch (error) {
      throw this.toApiError(error, 'Dolap ilan');
    }

    const { rows, total } = normalizeProductRows(data);
    const items: MarketplaceListing[] = rows.map((row, i) => {
      const p = isRecord(row) ? row : {};
      const idRaw = p.id ?? p.sku;
      const id =
        idRaw !== undefined && idRaw !== null ? String(idRaw) : `row-${String(i)}`;
      const barcode =
        typeof p.sku === 'string'
          ? p.sku
          : typeof p.id !== 'undefined'
            ? String(p.id)
            : id;
      const titleRaw = p.title ?? barcode;
      const title =
        typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
      const sale = parseMoney(p.price);
      return {
        platformProductId: id,
        barcode,
        title,
        quantity: DOLAP_FIXED_STOCK,
        salePrice: sale,
        listPrice: sale,
        approved: p.active !== false && p.status !== 'sold',
        images: [],
      };
    });

    return {
      items,
      total: typeof total === 'number' ? total : items.length,
      page,
      pageSize: 50,
    };
  }

  /**
   * Dolap ikinci el platform — stok her zaman 1, satılınca ilan otomatik kapanır.
   */
  async updateStock(
    _credentials: Record<string, string>,
    _updates: StockUpdatePayload[],
  ): Promise<void> {
    return;
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const update of updates) {
      const listingId = update.barcode;
      try {
        await client.put(`${DOLAP_LISTINGS_PATH}/${encodeURIComponent(listingId)}`, {
          price: update.salePrice,
        });
      } catch (error) {
        throw this.toApiError(error, 'Dolap fiyat');
      }
    }
  }

  /** Kargo bildirimi — `POST /orders/{id}/ship` */
  async submitShipment(
    credentials: Record<string, string>,
    orderId: string,
    payload: DolapShipPayload,
  ): Promise<void> {
    const client = this.getClient(credentials);
    try {
      await client.post(
        `${DOLAP_ORDERS_PATH}/${encodeURIComponent(orderId)}/ship`,
        payload,
      );
    } catch (error) {
      throw this.toApiError(error, 'Dolap kargo');
    }
  }
}
