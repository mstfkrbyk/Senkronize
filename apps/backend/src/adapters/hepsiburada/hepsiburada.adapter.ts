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
  HEPSIBURADA_BASE_URL,
  HEPSIBURADA_INTEGRATION_ID,
  HEPSIBURADA_ORDERS_URL,
} from './hepsiburada.constants';
import type {
  HepsiburadaListingsResponse,
  HepsiburadaOrdersResponse,
} from './hepsiburada.types';

@Injectable()
export class HepsiburadaAdapter implements IMarketplaceAdapter {
  readonly platform = 'HEPSIBURADA';
  private readonly logger = new Logger(HepsiburadaAdapter.name);

  // credentials: { username, password }
  private getListingClient(username: string, password: string): AxiosInstance {
    return axios.create({
      baseURL: HEPSIBURADA_BASE_URL,
      auth: { username, password },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Senkronize/${HEPSIBURADA_INTEGRATION_ID}`,
      },
      timeout: 15_000,
    });
  }

  private getOrderClient(username: string, password: string): AxiosInstance {
    return axios.create({
      baseURL: HEPSIBURADA_ORDERS_URL,
      auth: { username, password },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Senkronize/${HEPSIBURADA_INTEGRATION_ID}`,
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const username = credentials.username;
      const password = credentials.password;
      if (!username || !password) {
        return false;
      }
      const client = this.getListingClient(username, password);
      await client.get('/product/api/merchants/self');
      return true;
    } catch (error) {
      this.logger.warn('Hepsiburada bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const { username, password } = credentials;
    const client = this.getOrderClient(username, password);

    const params: Record<string, string | number> = { size: 100, page: 0 };
    if (since) {
      params['beginDate'] = since.toISOString();
    }

    const { data } = await client.get<HepsiburadaOrdersResponse>(
      '/order/merchantlisted/allorders',
      { params },
    );

    return data.data.orders.map((o) => ({
      platformOrderId: o.orderNumber,
      status: o.status,
      customerName: o.customerName,
      items: o.lineItems.map((item) => ({
        sku: item.merchantSku,
        barcode: item.barcode,
        quantity: item.quantity,
        unitPrice: item.price,
        platformItemId: item.lineItemId,
        productName: item.productName,
      })),
      totalAmount: o.totalPrice,
      currency: 'TRY',
      createdAt: o.orderDate,
      cargoTrackingNumber: o.shippingDetails?.trackingNumber,
      cargoProvider: o.shippingDetails?.providerName,
    }));
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const { username, password } = credentials;
    const client = this.getListingClient(username, password);

    const { data } = await client.get<HepsiburadaListingsResponse>(
      '/listings/merchantid/self/listings',
      { params: { offset: page * 50, limit: 50 } },
    );

    return {
      items: data.data.listings.map((l) => ({
        platformProductId: l.hepsiburadaSku,
        barcode: l.barcode,
        title: l.productName,
        quantity: l.availableStock,
        salePrice: l.price,
        listPrice: l.listPrice,
        approved: l.isSalable,
        images: l.images,
      })),
      total: data.data.totalCount,
      page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const { username, password } = credentials;
    const client = this.getListingClient(username, password);
    const batches = chunk(updates, 20);
    for (const batch of batches) {
      await client.post('/listings/merchantid/self/inventory-uploads', {
        items: batch.map((u) => ({
          merchantSku: u.barcode,
          availableStock: u.quantity,
        })),
      });
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const { username, password } = credentials;
    const client = this.getListingClient(username, password);
    const batches = chunk(updates, 20);
    for (const batch of batches) {
      await client.post('/listings/merchantid/self/price-updates', {
        items: batch.map((u) => ({
          merchantSku: u.barcode,
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
