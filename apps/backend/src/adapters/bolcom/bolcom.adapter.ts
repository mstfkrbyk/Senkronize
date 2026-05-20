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

import { axiosWithRetry } from '../../common/utils/http-retry';
import {
  isRecord,
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
} from '../stub-helpers';
import {
  BOLCOM_ACCEPT_HEADER,
  BOLCOM_API_BASE,
  BOLCOM_INVENTORY_PATH,
  BOLCOM_OFFERS_PATH,
  BOLCOM_ORDERS_PATH,
  BOLCOM_TOKEN_URL,
} from './bolcom.constants';

interface BolcomTokenResponse {
  access_token?: string;
}

@Injectable()
export class BolcomAdapter implements IMarketplaceAdapter {
  readonly platform = 'BOLCOM';
  private readonly logger = new Logger(BolcomAdapter.name);

  private resolveClientCredentials(credentials: Record<string, string>): {
    clientId: string;
    clientSecret: string;
  } {
    const clientId = credentials.clientId?.trim() ?? credentials.apiKey?.trim();
    const clientSecret =
      credentials.clientSecret?.trim() ?? credentials.apiSecret?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('Bol.com: clientId (API key) ve clientSecret zorunludur');
    }
    return { clientId, clientSecret };
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const { clientId, clientSecret } = this.resolveClientCredentials(credentials);
    const data = await axiosWithRetry<BolcomTokenResponse>(
      {
        method: 'POST',
        url: BOLCOM_TOKEN_URL,
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'grant_type=client_credentials',
        timeout: 15_000,
      },
      {},
    );
    const token =
      typeof data.access_token === 'string' ? data.access_token.trim() : '';
    if (!token) {
      throw new Error('Bol.com: access_token alınamadı');
    }
    return token;
  }

  private async getApiClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const token = await this.getAccessToken(credentials);
    return axios.create({
      baseURL: BOLCOM_API_BASE,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: BOLCOM_ACCEPT_HEADER,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }

  private toApiError(error: unknown, label: string): Error {
    if (axios.isAxiosError(error)) {
      const ax = error as AxiosError<{ detail?: string; title?: string }>;
      const status = ax.response?.status;
      const body = ax.response?.data;
      const detail =
        typeof body === 'object' && body !== null
          ? (typeof body.detail === 'string'
              ? body.detail
              : typeof body.title === 'string'
                ? body.title
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
      const client = await this.getApiClient(credentials);
      await client.get(BOLCOM_ORDERS_PATH, {
        params: { 'fulfilment-method': 'FBR', page: 1 },
      });
      return true;
    } catch (error) {
      this.logger.warn('Bol.com bağlantı testi başarısız', {
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
    let page = 1;
    let hasMore = true;
    const sinceMs = since?.getTime() ?? null;

    while (hasMore) {
      let data: unknown;
      try {
        const res = await client.get<unknown>(BOLCOM_ORDERS_PATH, {
          params: { 'fulfilment-method': 'FBR', page },
        });
        data = res.data;
      } catch (error) {
        throw this.toApiError(error, 'Bol.com sipariş');
      }

      const rows = normalizeOrdersRows(data);
      for (const row of rows) {
        const mapped = this.mapOrder(row, sinceMs);
        if (mapped) {
          all.push(mapped);
        }
      }

      if (isRecord(data) && Array.isArray(data.orders)) {
        hasMore = data.orders.length > 0;
      } else {
        hasMore = rows.length > 0;
      }
      page += 1;
      if (page > 50) {
        break;
      }
    }

    return all;
  }

  private mapOrder(row: unknown, sinceMs: number | null): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const idRaw = row.orderId ?? row.id ?? row.orderNumber;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const createdRaw =
      row.orderPlacedDateTime ??
      row.createdAt ??
      row.orderDate;
    const createdAt =
      createdRaw !== undefined && createdRaw !== null
        ? new Date(String(createdRaw)).toISOString()
        : new Date().toISOString();
    if (sinceMs !== null) {
      const t = Date.parse(createdAt);
      if (!Number.isNaN(t) && t < sinceMs) {
        return null;
      }
    }
    const nameRaw =
      row.customerName ??
      (isRecord(row.shipmentDetails) ? row.shipmentDetails.firstName : undefined);
    return {
      platformOrderId: String(idRaw),
      status: typeof row.status === 'string' ? row.status : 'NEW',
      customerName:
        typeof nameRaw === 'string' && nameRaw.length > 0 ? nameRaw : '—',
      items: [],
      totalAmount: parseMoney(row.totalPrice ?? row.totalAmount),
      currency: 'EUR',
      createdAt,
      cargoTrackingNumber: undefined,
      cargoProvider: undefined,
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const client = await this.getApiClient(credentials);
    const apiPage = page + 1;
    let data: unknown;
    try {
      const res = await client.get<unknown>(BOLCOM_OFFERS_PATH, {
        params: { page: apiPage },
      });
      data = res.data;
    } catch (error) {
      throw this.toApiError(error, 'Bol.com teklif');
    }

    const { rows, total } = normalizeProductRows(data);
    const items: MarketplaceListing[] = rows.map((row, i) => {
      const p = isRecord(row) ? row : {};
      const eanRaw = p.ean ?? p.reference ?? p.barcode;
      const ean =
        eanRaw !== undefined && eanRaw !== null
          ? String(eanRaw)
          : `row-${String(i)}`;
      const pricing = isRecord(p.pricing) ? p.pricing : {};
      const bundle = Array.isArray(pricing.bundlePrices)
        ? pricing.bundlePrices[0]
        : undefined;
      const unitPrice = isRecord(bundle) ? bundle.unitPrice : undefined;
      const sale = parseMoney(unitPrice ?? p.salePrice ?? p.price);
      const qtyRaw = p.stock ?? p.quantity ?? 0;
      const quantity =
        typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
          ? Math.max(0, Math.round(qtyRaw))
          : 0;
      const titleRaw = p.title ?? p.name ?? ean;
      return {
        platformProductId: ean,
        barcode: ean,
        title: typeof titleRaw === 'string' ? titleRaw : String(titleRaw),
        quantity,
        salePrice: sale,
        listPrice: sale,
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
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = await this.getApiClient(credentials);
    const country =
      credentials.inventoryCountry?.trim() ??
      credentials.country?.trim() ??
      'NL';

    for (const u of updates) {
      try {
        await client.put(BOLCOM_INVENTORY_PATH, {
          reference: u.barcode,
          quantity: u.quantity,
          location: { country },
        });
      } catch (error) {
        throw this.toApiError(error, 'Bol.com stok');
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const client = await this.getApiClient(credentials);
    for (const u of updates) {
      try {
        await client.put(BOLCOM_OFFERS_PATH, {
          ean: u.barcode,
          condition: { name: 'NEW' },
          pricing: {
            bundlePrices: [
              {
                quantity: 1,
                unitPrice: u.salePrice,
              },
            ],
          },
          reference: credentials.offerReference?.trim() ?? u.barcode,
        });
      } catch (error) {
        throw this.toApiError(error, 'Bol.com fiyat');
      }
    }
  }
}
