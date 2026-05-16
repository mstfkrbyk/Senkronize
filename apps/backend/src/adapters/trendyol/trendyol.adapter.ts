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

import { TRENDYOL_BASE_URL, TRENDYOL_INTEGRATOR_ID } from './trendyol.constants';
import type {
  TrendyolOrdersResponse,
  TrendyolProductsResponse,
} from './trendyol.types';

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
      baseURL: `${TRENDYOL_BASE_URL}/suppliers/${sellerId}`,
      auth: { username: apiKey, password: apiSecret },
      headers: {
        'User-Agent': `${sellerId} - ${TRENDYOL_INTEGRATOR_ID}`,
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
      await client.get('/addresses');
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

    const { data } = await client.get<TrendyolOrdersResponse>('/orders', {
      params,
    });

    return data.content.map((o) => {
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

    const { data } = await client.get<TrendyolProductsResponse>('/products', {
      params: { page, size: 50 },
    });

    return {
      items: data.content.map((p) => ({
        platformProductId: p.id,
        barcode: p.barcode,
        title: p.title,
        quantity: p.quantity,
        salePrice: p.salePrice,
        listPrice: p.listPrice,
        approved: p.approved,
        images: p.images.map((i) => i.url),
      })),
      total: data.totalElements,
      page: data.page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const { sellerId, apiKey, apiSecret } = credentials;
    const client = this.getClient(sellerId, apiKey, apiSecret);

    const batches = chunk(updates, 100);
    for (const batch of batches) {
      await client.post('/products/price-and-inventory', {
        items: batch.map((u) => ({
          barcode: u.barcode,
          quantity: u.quantity,
        })),
      });
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const { sellerId, apiKey, apiSecret } = credentials;
    const client = this.getClient(sellerId, apiKey, apiSecret);

    const batches = chunk(updates, 100);
    for (const batch of batches) {
      await client.post('/products/price-and-inventory', {
        items: batch.map((u) => ({
          barcode: u.barcode,
          salePrice: u.salePrice,
          listPrice: u.listPrice,
        })),
      });
    }
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
