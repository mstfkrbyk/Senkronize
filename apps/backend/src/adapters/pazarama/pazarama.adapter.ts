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
  PAZARAMA_CONNECT_BASE,
  PAZARAMA_OAUTH_TOKEN_PATH,
  PAZARAMA_ORDERS_PATH,
  PAZARAMA_UPDATE_PRICE_STOCK_PATH,
  pazaramaOrderCargoPath,
} from './pazarama.constants';

function isRecordLocal(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface PazaramaCargoPayload {
  cargoTrackingNumber: string;
  cargoCompanyCode: string;
}

interface PazaramaTokenResponse {
  access_token?: string;
  expires_in?: number;
}

@Injectable()
export class PazaramaAdapter implements IMarketplaceAdapter {
  readonly platform: string = 'PAZARAMA';
  private readonly logger = new Logger(PazaramaAdapter.name);

  /** Pazarama Premium vb. ek başlıklar */
  protected extraApiHeaders(
    credentials: Record<string, string>,
  ): Record<string, string> {
    void credentials;
    return {};
  }

  private resolveAuthPair(credentials: Record<string, string>): {
    username: string;
    password: string;
    clientId: string;
    clientSecret: string;
  } {
    const username =
      credentials.username?.trim() ??
      credentials.apiKey?.trim() ??
      credentials.clientId?.trim();
    const password =
      credentials.password?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.clientSecret?.trim();
    const clientId =
      credentials.clientId?.trim() ??
      credentials.apiKey?.trim() ??
      username;
    const clientSecret =
      credentials.clientSecret?.trim() ??
      credentials.apiSecret?.trim() ??
      password;
    if (!username || !password || !clientId || !clientSecret) {
      throw new Error(
        'Pazarama: username/password veya apiKey/apiSecret (client_id/client_secret) zorunludur',
      );
    }
    return { username, password, clientId, clientSecret };
  }

  private basicAuthHeader(username: string, password: string): string {
    return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
  }

  private formatApiDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const { username, password, clientId, clientSecret } =
      this.resolveAuthPair(credentials);
    try {
      const { data } = await axios.post<PazaramaTokenResponse>(
        `${PAZARAMA_CONNECT_BASE}${PAZARAMA_OAUTH_TOKEN_PATH}`,
        {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.basicAuthHeader(username, password),
          },
          timeout: 10_000,
        },
      );
      if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
        throw new Error('access_token alınamadı');
      }
      return data.access_token;
    } catch (error) {
      throw this.toApiError(error, 'Pazarama token');
    }
  }

  private async getApiClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const token = await this.getToken(credentials);
    return axios.create({
      baseURL: PAZARAMA_CONNECT_BASE,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...this.extraApiHeaders(credentials),
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

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.getToken(credentials);
      return true;
    } catch (error) {
      this.logger.warn('Pazarama bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const client = await this.getApiClient(credentials);
    const end = new Date();
    const start = since ?? new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const all: MarketplaceOrder[] = [];
    let pageIndex = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      let data: unknown;
      try {
        const res = await client.get<unknown>(PAZARAMA_ORDERS_PATH, {
          params: {
            status: 1,
            startDate: this.formatApiDate(start),
            endDate: this.formatApiDate(end),
            pageIndex,
            pageSize,
          },
        });
        data = res.data;
      } catch (error) {
        throw this.toApiError(error, 'Pazarama sipariş');
      }

      const rows = normalizeOrdersRows(data);
      for (const [index, row] of rows.entries()) {
        const o = isRecordLocal(row) ? row : {};
        const idRaw = o.id ?? o.orderId ?? o.orderNumber;
        if (idRaw === undefined || idRaw === null) {
          this.logger.warn('Pazarama sipariş kaydında id eksik', { index });
          continue;
        }
        const createdRaw = o.createdAt ?? o.orderDate;
        const createdAt =
          createdRaw !== undefined && createdRaw !== null
            ? new Date(String(createdRaw)).toISOString()
            : new Date().toISOString();
        const nameRaw = o.customerName ?? o.buyerName ?? '';
        all.push({
          platformOrderId: String(idRaw),
          status: typeof o.status === 'string' ? o.status : 'NEW',
          customerName:
            typeof nameRaw === 'string' && nameRaw.length > 0 ? nameRaw : '—',
          items: [],
          totalAmount: parseMoney(o.totalPrice ?? o.totalAmount),
          currency: 'TRY',
          createdAt,
          cargoTrackingNumber:
            typeof o.cargoTrackingNumber === 'string'
              ? o.cargoTrackingNumber
              : undefined,
          cargoProvider:
            typeof o.cargoCompanyCode === 'string'
              ? o.cargoCompanyCode
              : undefined,
        });
      }

      if (isRecord(data)) {
        const totalRaw = data.totalCount ?? data.total;
        const total =
          typeof totalRaw === 'number' && Number.isFinite(totalRaw)
            ? totalRaw
            : undefined;
        if (typeof total === 'number') {
          hasMore = pageIndex * pageSize < total;
        } else {
          hasMore = rows.length >= pageSize;
        }
      } else {
        hasMore = rows.length >= pageSize;
      }
      pageIndex += 1;
    }

    return all;
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const client = await this.getApiClient(credentials);
    const pageIndex = page + 1;
    let data: unknown;
    try {
      const res = await client.get<unknown>('/products', {
        params: { pageIndex, pageSize: 50 },
      });
      data = res.data;
    } catch (error) {
      throw this.toApiError(error, 'Pazarama ürün');
    }

    const { rows, total } = normalizeProductRows(data);
    const items: MarketplaceListing[] = rows.map((row, i) => {
      const p = isRecordLocal(row) ? row : {};
      const codeRaw = p.code ?? p.barcode ?? p.sku ?? p.id;
      const code =
        codeRaw !== undefined && codeRaw !== null
          ? String(codeRaw)
          : `row-${String(i)}`;
      const titleRaw = p.name ?? p.title ?? code;
      const sale = parseMoney(p.salePrice ?? p.price);
      const list = parseMoney(p.listPrice ?? p.price ?? sale);
      const qtyRaw = p.quantity ?? p.stockCount ?? p.stock ?? 0;
      const quantity =
        typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
          ? Math.max(0, Math.round(qtyRaw))
          : 0;
      const statusStr =
        typeof p.status === 'string' ? p.status.toUpperCase() : 'ACTIVE';
      return {
        platformProductId: code,
        barcode: code,
        title: typeof titleRaw === 'string' ? titleRaw : String(titleRaw),
        quantity,
        salePrice: sale,
        listPrice: list,
        approved: statusStr === 'ACTIVE',
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

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    await this.putPriceQuantityItems(
      credentials,
      updates.map((u) => ({ code: u.barcode, quantity: u.quantity })),
    );
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    await this.putPriceQuantityItems(
      credentials,
      updates.map((u) => ({
        code: u.barcode,
        salePrice: u.salePrice,
        listPrice: u.listPrice,
      })),
    );
  }

  private async putPriceQuantityItems(
    credentials: Record<string, string>,
    items: Array<{
      code: string;
      quantity?: number;
      salePrice?: number;
      listPrice?: number;
    }>,
  ): Promise<void> {
    const client = await this.getApiClient(credentials);
    try {
      await client.put(PAZARAMA_UPDATE_PRICE_STOCK_PATH, { items });
    } catch (error) {
      throw this.toApiError(error, 'Pazarama fiyat/stok');
    }
  }

  /** Kargo bildirimi — `PUT /orders/{orderNumber}/cargo` */
  async submitCargo(
    credentials: Record<string, string>,
    orderNumber: string,
    payload: PazaramaCargoPayload,
  ): Promise<void> {
    const client = await this.getApiClient(credentials);
    try {
      await client.put(pazaramaOrderCargoPath(orderNumber), payload);
    } catch (error) {
      throw this.toApiError(error, 'Pazarama kargo');
    }
  }
}
