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
  PAZARAMA_API_BASE,
  PAZARAMA_ORDER_STATUS_CREATED,
  PAZARAMA_ORDERS_PATH,
  PAZARAMA_PRICE_PATH,
  PAZARAMA_PRODUCTS_PATH,
  PAZARAMA_SHIPMENT_PATH,
  PAZARAMA_STOCK_PATH,
  PAZARAMA_TOKEN_PATH,
  pazaramaOrderDetailPath,
} from './pazarama.constants';
import type {
  PazaramaPriceItem,
  PazaramaShipmentPayload,
  PazaramaStockItem,
  PazaramaTokenResponse,
} from './pazarama.types';

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class PazaramaAdapter implements IMarketplaceAdapter {
  readonly platform: string = 'PAZARAMA';
  private readonly logger = new Logger(PazaramaAdapter.name);
  private readonly tokenCache = new Map<string, CachedToken>();

  /** Pazarama Premium vb. ek başlıklar */
  protected extraApiHeaders(
    credentials: Record<string, string>,
  ): Record<string, string> {
    void credentials;
    return {};
  }

  private resolveCredentials(credentials: Record<string, string>): {
    username: string;
    password: string;
  } {
    const username =
      credentials.username?.trim() ??
      credentials.apiKey?.trim() ??
      credentials.clientId?.trim();
    const password =
      credentials.password?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.clientSecret?.trim();
    if (!username || !password) {
      throw new Error('Pazarama: username ve password zorunludur');
    }
    return { username, password };
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

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const { username, password } = this.resolveCredentials(credentials);
    const cacheKey = username;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.token;
    }

    try {
      const { data } = await axios.post<PazaramaTokenResponse>(
        `${PAZARAMA_API_BASE}${PAZARAMA_TOKEN_PATH}`,
        { username, password },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10_000,
        },
      );
      const token =
        (typeof data.accessToken === 'string' && data.accessToken) ||
        (typeof data.access_token === 'string' && data.access_token) ||
        '';
      if (token.length === 0) {
        throw new Error('accessToken alınamadı');
      }
      const ttlSec =
        typeof data.expiresIn === 'number'
          ? data.expiresIn
          : typeof data.expires_in === 'number'
            ? data.expires_in
            : 3600;
      this.tokenCache.set(cacheKey, {
        token,
        expiresAt: Date.now() + ttlSec * 1000,
      });
      return token;
    } catch (error) {
      throw this.toApiError(error, 'Pazarama token');
    }
  }

  private async getApiClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const token = await this.getToken(credentials);
    return axios.create({
      baseURL: PAZARAMA_API_BASE,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...this.extraApiHeaders(credentials),
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = await this.getApiClient(credentials);
      await client.get(PAZARAMA_ORDERS_PATH, {
        params: {
          pageSize: 1,
          pageIndex: 0,
          status: PAZARAMA_ORDER_STATUS_CREATED,
        },
      });
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
    const all: MarketplaceOrder[] = [];
    let pageIndex = 0;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      let data: unknown;
      try {
        const res = await client.get<unknown>(PAZARAMA_ORDERS_PATH, {
          params: {
            pageSize,
            pageIndex,
            status: PAZARAMA_ORDER_STATUS_CREATED,
          },
        });
        data = res.data;
      } catch (error) {
        throw this.toApiError(error, 'Pazarama sipariş');
      }

      const rows = normalizeOrdersRows(data);
      for (const [index, row] of rows.entries()) {
        const o = isRecord(row) ? row : {};
        const idRaw = o.orderNumber ?? o.id ?? o.orderId;
        if (idRaw === undefined || idRaw === null) {
          this.logger.warn('Pazarama sipariş kaydında id eksik', { index });
          continue;
        }
        const createdRaw = o.createdAt ?? o.orderDate ?? o.createdDate;
        const createdAt =
          createdRaw !== undefined && createdRaw !== null
            ? new Date(String(createdRaw)).toISOString()
            : new Date().toISOString();
        if (since && new Date(createdAt).getTime() < since.getTime()) {
          continue;
        }
        const nameRaw = o.customerName ?? o.buyerName ?? o.receiverName ?? '';
        all.push({
          platformOrderId: String(idRaw),
          status: typeof o.status === 'string' ? o.status : PAZARAMA_ORDER_STATUS_CREATED,
          customerName:
            typeof nameRaw === 'string' && nameRaw.length > 0 ? nameRaw : '—',
          items: [],
          totalAmount: parseMoney(o.totalPrice ?? o.totalAmount ?? o.amount),
          currency: 'TRY',
          createdAt,
          cargoTrackingNumber:
            typeof o.trackingNumber === 'string'
              ? o.trackingNumber
              : typeof o.cargoTrackingNumber === 'string'
                ? o.cargoTrackingNumber
                : undefined,
          cargoProvider:
            typeof o.cargoCode === 'string'
              ? o.cargoCode
              : typeof o.cargoCompanyCode === 'string'
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
          hasMore = (pageIndex + 1) * pageSize < total;
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

  /** Sipariş detayı — `GET /orders/{orderNumber}` */
  async getOrderDetail(
    credentials: Record<string, string>,
    orderNumber: string,
  ): Promise<unknown> {
    const client = await this.getApiClient(credentials);
    try {
      const res = await client.get<unknown>(pazaramaOrderDetailPath(orderNumber));
      return res.data;
    } catch (error) {
      throw this.toApiError(error, 'Pazarama sipariş detayı');
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const client = await this.getApiClient(credentials);
    let data: unknown;
    try {
      const res = await client.get<unknown>(PAZARAMA_PRODUCTS_PATH, {
        params: { pageSize: 100, pageIndex: page },
      });
      data = res.data;
    } catch (error) {
      throw this.toApiError(error, 'Pazarama ürün');
    }

    const { rows, total } = normalizeProductRows(data);
    const items: MarketplaceListing[] = rows.map((row, i) => {
      const p = isRecord(row) ? row : {};
      const codeRaw = p.productCode ?? p.code ?? p.barcode ?? p.sku ?? p.id;
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
        approved: statusStr === 'ACTIVE' || statusStr === 'APPROVED',
        images: [],
      };
    });

    return {
      items,
      total: typeof total === 'number' ? total : items.length,
      page,
      pageSize: 100,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = await this.getApiClient(credentials);
    const body: PazaramaStockItem[] = updates.map((u) => ({
      productCode: u.barcode,
      quantity: u.quantity,
    }));
    try {
      await client.put(PAZARAMA_STOCK_PATH, body);
    } catch (error) {
      throw this.toApiError(error, 'Pazarama stok');
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const client = await this.getApiClient(credentials);
    const body: PazaramaPriceItem[] = updates.map((u) => ({
      productCode: u.barcode,
      salePrice: u.salePrice,
      listPrice: u.listPrice,
    }));
    try {
      await client.put(PAZARAMA_PRICE_PATH, body);
    } catch (error) {
      throw this.toApiError(error, 'Pazarama fiyat');
    }
  }

  /** Kargo bildirimi — `PUT /orders/shipment` */
  async submitShipment(
    credentials: Record<string, string>,
    payload: PazaramaShipmentPayload,
  ): Promise<void> {
    const client = await this.getApiClient(credentials);
    try {
      await client.put(PAZARAMA_SHIPMENT_PATH, payload);
    } catch (error) {
      throw this.toApiError(error, 'Pazarama kargo');
    }
  }
}
