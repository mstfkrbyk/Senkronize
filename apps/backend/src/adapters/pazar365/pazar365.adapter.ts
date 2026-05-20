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
  PAZAR365_API_BASE,
  PAZAR365_ORDERS_PATH,
  PAZAR365_PRODUCTS_PATH,
  pazar365OrderCargoPath,
  pazar365ProductPricePath,
  pazar365ProductStockPath,
} from './pazar365.constants';
import type {
  Pazar365OrderRow,
  Pazar365OrdersResponse,
  Pazar365ProductRow,
  Pazar365ProductsResponse,
} from './pazar365.types';

export interface Pazar365CargoPayload {
  cargoCode: string;
  trackingNumber: string;
}

@Injectable()
export class Pazar365Adapter implements IMarketplaceAdapter {
  readonly platform = 'PAZAR365';
  private readonly logger = new Logger(Pazar365Adapter.name);

  private resolveCredentials(credentials: Record<string, string>): {
    apiKey: string;
    apiSecret: string;
  } {
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!apiKey || !apiSecret) {
      throw new Error('Pazar365: apiKey ve apiSecret zorunludur');
    }
    return { apiKey, apiSecret };
  }

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const { apiKey, apiSecret } = this.resolveCredentials(credentials);
    return axios.create({
      baseURL: PAZAR365_API_BASE,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Secret': apiSecret,
      },
      timeout: 15_000,
    });
  }

  private toApiError(error: unknown, label: string): Error {
    if (axios.isAxiosError(error)) {
      const ax = error as AxiosError<{ message?: string }>;
      const status = ax.response?.status;
      const body = ax.response?.data;
      const detail =
        typeof body === 'object' && body !== null && typeof body.message === 'string'
          ? body.message
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

  private formatApiDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = this.getClient(credentials);
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 3600 * 1000);
      await client.get(PAZAR365_ORDERS_PATH, {
        params: {
          startDate: this.formatApiDate(start),
          endDate: this.formatApiDate(end),
          status: 'New',
          page: 1,
          pageSize: 1,
        },
      });
      return true;
    } catch (error) {
      this.logger.warn('Pazar365 bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const client = this.getClient(credentials);
    const end = new Date();
    const start = since ?? new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const all: MarketplaceOrder[] = [];
    let page = 1;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore) {
      let data: unknown;
      try {
        const res = await client.get<unknown>(PAZAR365_ORDERS_PATH, {
          params: {
            startDate: this.formatApiDate(start),
            endDate: this.formatApiDate(end),
            status: 'New',
            page,
            pageSize,
          },
        });
        data = res.data;
      } catch (error) {
        throw this.toApiError(error, 'Pazar365 sipariş');
      }

      const rows = normalizeOrdersRows(data) as Pazar365OrderRow[];
      for (const row of rows) {
        const mapped = this.mapOrder(row);
        if (mapped) {
          all.push(mapped);
        }
      }

      const total =
        isRecord(data) && typeof (data as Pazar365OrdersResponse).totalCount === 'number'
          ? (data as Pazar365OrdersResponse).totalCount
          : isRecord(data) && typeof (data as Pazar365OrdersResponse).total === 'number'
            ? (data as Pazar365OrdersResponse).total
            : undefined;
      if (typeof total === 'number' && total > 0) {
        hasMore = page * pageSize < total;
      } else {
        hasMore = rows.length >= pageSize;
      }
      page += 1;
    }

    return all;
  }

  private mapOrder(row: Pazar365OrderRow): MarketplaceOrder | null {
    const idRaw = row.id ?? row.orderId;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const createdRaw = row.createdAt ?? row.orderDate;
    const createdAt =
      createdRaw !== undefined && createdRaw !== null
        ? new Date(String(createdRaw)).toISOString()
        : new Date().toISOString();
    const nameRaw = row.customerName ?? row.buyerName ?? '';
    return {
      platformOrderId: String(idRaw),
      status: typeof row.status === 'string' ? row.status : 'NEW',
      customerName:
        typeof nameRaw === 'string' && nameRaw.length > 0 ? nameRaw : '—',
      items: [],
      totalAmount: parseMoney(row.totalPrice ?? row.totalAmount),
      currency: 'TRY',
      createdAt,
      cargoTrackingNumber:
        typeof row.cargoTrackingNumber === 'string'
          ? row.cargoTrackingNumber
          : typeof row.trackingNumber === 'string'
            ? row.trackingNumber
            : undefined,
      cargoProvider:
        typeof row.cargoCode === 'string' ? row.cargoCode : undefined,
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const client = this.getClient(credentials);
    const apiPage = page + 1;
    let data: unknown;
    try {
      const res = await client.get<unknown>(PAZAR365_PRODUCTS_PATH, {
        params: { page: apiPage, pageSize: 50 },
      });
      data = res.data;
    } catch (error) {
      throw this.toApiError(error, 'Pazar365 ürün');
    }

    const { rows, total } = normalizeProductRows(data);
    const items: MarketplaceListing[] = (rows as Pazar365ProductRow[]).map(
      (p, i) => {
        const code =
          (typeof p.productCode === 'string' && p.productCode) ||
          (typeof p.code === 'string' && p.code) ||
          (typeof p.barcode === 'string' && p.barcode) ||
          (typeof p.sku === 'string' && p.sku) ||
          `row-${String(i)}`;
        const idRaw = p.id ?? code;
        const sale = parseMoney(p.discountedPrice ?? p.salePrice ?? p.price);
        const list = parseMoney(p.price ?? p.salePrice ?? sale);
        const qtyRaw = p.quantity ?? p.stock ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        const titleRaw = p.name ?? p.title ?? code;
        return {
          platformProductId: String(idRaw),
          barcode: code,
          title: typeof titleRaw === 'string' ? titleRaw : String(titleRaw),
          quantity,
          salePrice: sale,
          listPrice: list,
          approved:
            typeof p.status !== 'string' ||
            p.status.toUpperCase() === 'ACTIVE' ||
            p.status.toUpperCase() === 'APPROVED',
          images: [],
        };
      },
    );

    return {
      items,
      total: typeof total === 'number' ? total : items.length,
      page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        await client.patch(pazar365ProductStockPath(u.barcode), {
          quantity: u.quantity,
        });
      } catch (error) {
        throw this.toApiError(error, 'Pazar365 stok');
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    for (const u of updates) {
      try {
        await client.patch(pazar365ProductPricePath(u.barcode), {
          price: u.listPrice,
          discountedPrice: u.salePrice,
        });
      } catch (error) {
        throw this.toApiError(error, 'Pazar365 fiyat');
      }
    }
  }

  /** Kargo bildirimi — `POST /orders/{orderId}/cargo` */
  async submitCargo(
    credentials: Record<string, string>,
    orderId: string,
    payload: Pazar365CargoPayload,
  ): Promise<void> {
    const client = this.getClient(credentials);
    try {
      await client.post(pazar365OrderCargoPath(orderId), payload);
    } catch (error) {
      throw this.toApiError(error, 'Pazar365 kargo');
    }
  }
}
