import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';
import {
  TRENDYOL_BASE_URL,
  TRENDYOL_PRODUCTS,
  TRENDYOL_SELLER_ORDERS,
  TRENDYOL_SHIPMENT_PROVIDERS,
  TRENDYOL_STOCK_UPDATE,
  TRENDYOL_USER_AGENT_SUFFIX,
  trendyolSellerPath,
} from './trendyol.constants';
import type {
  TrendyolOrdersResponse,
  TrendyolProductsResponse,
} from './trendyol.types';

const BATCH_DELAY_MS = 100;

@Injectable()
export class TrendyolAdapter implements IMarketplaceAdapter {
  readonly platform = 'TRENDYOL';
  private readonly logger = new Logger(TrendyolAdapter.name);

  private getClient(
    sellerId: string,
    apiKey: string,
    apiSecret: string,
  ): AxiosInstance {
    return axios.create({
      baseURL: TRENDYOL_BASE_URL,
      auth: { username: apiKey, password: apiSecret },
      headers: {
        'User-Agent': `${sellerId} - ${TRENDYOL_USER_AGENT_SUFFIX}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { sellerId, apiKey, apiSecret } = credentials;
      if (!sellerId || !apiKey || !apiSecret) {
        return false;
      }
      const client = this.getClient(sellerId, apiKey, apiSecret);
      await client.get(trendyolSellerPath(TRENDYOL_SHIPMENT_PROVIDERS, sellerId));
      return true;
    } catch (error) {
      this.logger.warn('Trendyol bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const { sellerId, apiKey, apiSecret } = credentials;
    const client = this.getClient(sellerId, apiKey, apiSecret);

    const startDate = since
      ? since.getTime()
      : Date.now() - 24 * 60 * 60 * 1000;
    const params = {
      startDate,
      endDate: Date.now(),
      page: 0,
      size: 200,
      status: 'Created,Picking,Invoiced,Shipped,Delivered',
    };

    const { data } = await client.get<TrendyolOrdersResponse>(
      trendyolSellerPath(TRENDYOL_SELLER_ORDERS, sellerId),
      { params },
    );

    const rows = data.orders ?? data.content ?? [];

    return rows.map((o) => {
      const first = o.shipmentAddress?.firstName ?? '';
      const last = o.shipmentAddress?.lastName ?? '';
      const customerName = `${first} ${last}`.trim() || '—';
      return {
        platformOrderId: String(o.id),
        status: o.status,
        customerName,
        items: o.lines.map((l) => ({
          sku: l.merchantSku,
          barcode: l.barcode,
          quantity: l.quantity,
          unitPrice: l.price,
          platformItemId: String(l.id),
          productName: l.productName,
        })),
        totalAmount: o.grossAmount,
        currency: o.currencyCode,
        createdAt: new Date(o.orderDate).toISOString(),
        cargoTrackingNumber: o.cargoTrackingNumber,
        cargoProvider: o.cargoProviderName,
      };
    });
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const { sellerId, apiKey, apiSecret } = credentials;
    const client = this.getClient(sellerId, apiKey, apiSecret);

    const { data } = await client.get<TrendyolProductsResponse>(
      trendyolSellerPath(TRENDYOL_PRODUCTS, sellerId),
      { params: { page, size: 50 } },
    );

    const productRows = data.content ?? data.products ?? [];
    const total =
      data.totalElements ?? data.totalCount ?? productRows.length;

    return {
      items: productRows.map((p) => ({
        platformProductId: p.id,
        barcode: p.barcode,
        title: p.title,
        quantity: p.quantity,
        salePrice: p.salePrice,
        listPrice: p.listPrice,
        approved: p.approved,
        images: p.images.map((i) => i.url),
      })),
      total,
      page: data.page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const { sellerId, apiKey, apiSecret } = credentials;
    const path = trendyolSellerPath(TRENDYOL_STOCK_UPDATE, sellerId);
    const url = `${TRENDYOL_BASE_URL}${path}`;
    const rpm =
      PLATFORM_RATE_LIMITS.TRENDYOL ?? PLATFORM_RATE_LIMITS.DEFAULT;
    const batches = chunkArray(updates, 100);

    for (let i = 0; i < batches.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
      const batch = batches[i]!;
      await withRateLimit('TRENDYOL', rpm, async () => {
        await axiosWithRetry(
          {
            method: 'PUT',
            url,
            auth: { username: apiKey, password: apiSecret },
            headers: {
              'User-Agent': `${sellerId} - ${TRENDYOL_USER_AGENT_SUFFIX}`,
              'Content-Type': 'application/json',
            },
            timeout: 15_000,
            data: {
              items: batch.map((u) => ({
                barcode: u.barcode,
                quantity: u.quantity,
              })),
            },
          },
          {},
        );
      });
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const { sellerId, apiKey, apiSecret } = credentials;
    const path = trendyolSellerPath(TRENDYOL_STOCK_UPDATE, sellerId);
    const url = `${TRENDYOL_BASE_URL}${path}`;
    const rpm =
      PLATFORM_RATE_LIMITS.TRENDYOL ?? PLATFORM_RATE_LIMITS.DEFAULT;
    const batches = chunkArray(updates, 100);

    for (let i = 0; i < batches.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
      const batch = batches[i]!;
      await withRateLimit('TRENDYOL', rpm, async () => {
        await axiosWithRetry(
          {
            method: 'PUT',
            url,
            auth: { username: apiKey, password: apiSecret },
            headers: {
              'User-Agent': `${sellerId} - ${TRENDYOL_USER_AGENT_SUFFIX}`,
              'Content-Type': 'application/json',
            },
            timeout: 15_000,
            data: {
              items: batch.map((u) => ({
                barcode: u.barcode,
                salePrice: u.salePrice,
                listPrice: u.listPrice,
              })),
            },
          },
          {},
        );
      });
    }
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, (i + 1) * size),
  );
}
