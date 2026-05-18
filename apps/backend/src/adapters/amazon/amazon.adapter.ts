import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  AMAZON_LWA_URL,
  AMAZON_SP_BASE_URL,
  AMAZON_TR_MARKETPLACE_ID,
} from './amazon.constants';
import type {
  AmazonListingsListResponse,
  AmazonLwaTokenResponse,
  AmazonOrdersListResponse,
  AmazonOrderPayload,
} from './amazon.types';

@Injectable()
export class AmazonAdapter implements IMarketplaceAdapter {
  readonly platform = 'AMAZON_TR';
  private readonly logger = new Logger(AmazonAdapter.name);

  private async getLwaToken(credentials: Record<string, string>): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });
    const { data } = await axios.post<AmazonLwaTokenResponse>(AMAZON_LWA_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20_000,
    });
    if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
      throw new Error('Amazon LWA yanıtında access_token yok');
    }
    return data.access_token;
  }

  private getClient(token: string): AxiosInstance {
    return axios.create({
      baseURL: AMAZON_SP_BASE_URL,
      headers: {
        'x-amz-access-token': token,
        'Content-Type': 'application/json',
      },
      timeout: 20_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { clientId, clientSecret, refreshToken, sellerId } = credentials;
      if (!clientId || !clientSecret || !refreshToken || !sellerId) {
        return false;
      }
      const token = await this.getLwaToken(credentials);
      await this.getClient(token).get('/sellers/v1/marketplaceParticipations');
      return true;
    } catch (error) {
      this.logger.warn('Amazon bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const token = await this.getLwaToken(credentials);
    const client = this.getClient(token);
    const createdAfter = since
      ? since.toISOString()
      : new Date(Date.now() - 7 * 86400000).toISOString();
    const q = new URLSearchParams();
    q.append('MarketplaceIds', AMAZON_TR_MARKETPLACE_ID);
    q.append('CreatedAfter', createdAfter);
    for (const status of ['Unshipped', 'Shipped', 'PartiallyShipped'] as const) {
      q.append('OrderStatuses', status);
    }
    const { data } = await client.get<AmazonOrdersListResponse>('/orders/v0/orders', {
      params: q,
    });
    const orders: AmazonOrderPayload[] = data.payload?.Orders ?? [];
    return orders.map((o) => {
      const buyerName = o.BuyerInfo?.BuyerName ?? '';
      const amount = parseFloat(o.OrderTotal?.Amount ?? '0');
      return {
        platformOrderId: o.AmazonOrderId,
        status: o.OrderStatus ?? 'Pending',
        customerName: buyerName.length > 0 ? buyerName : '—',
        items: [],
        totalAmount: Number.isFinite(amount) ? amount : 0,
        currency: o.OrderTotal?.CurrencyCode ?? 'TRY',
        createdAt: o.PurchaseDate
          ? new Date(o.PurchaseDate).toISOString()
          : new Date().toISOString(),
        cargoTrackingNumber: undefined,
        cargoProvider: undefined,
      };
    });
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const token = await this.getLwaToken(credentials);
    const client = this.getClient(token);
    const sellerId = credentials.sellerId;
    const { data } = await client.get<AmazonListingsListResponse>(
      `/listings/2021-08-01/items/${sellerId}`,
      {
        params: {
          marketplaceIds: AMAZON_TR_MARKETPLACE_ID,
          pageSize: 50,
        },
      },
    );
    const items = data.items ?? [];
    const rows: MarketplaceListing[] = items.map((i) => {
      const summary = i.summaries?.[0];
      const title = summary?.itemName ?? i.sku;
      const price = i.offers?.[0]?.price?.listingPrice?.amount ?? 0;
      const statusList = summary?.status ?? [];
      const approved = statusList.some((s) =>
        ['BUYABLE', 'DISCOVERABLE'].includes(String(s).toUpperCase()),
      );
      const mainImage = summary?.mainImage?.link;
      return {
        platformProductId: i.sku,
        barcode: i.sku,
        title,
        quantity: 0,
        salePrice: typeof price === 'number' && Number.isFinite(price) ? price : 0,
        listPrice: typeof price === 'number' && Number.isFinite(price) ? price : 0,
        approved,
        images: typeof mainImage === 'string' && mainImage.length > 0 ? [mainImage] : [],
      };
    });
    return {
      items: rows,
      total: rows.length,
      page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const token = await this.getLwaToken(credentials);
    const client = this.getClient(token);
    const sellerId = credentials.sellerId;
    for (const u of updates) {
      try {
        await client.patch(
          `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(u.barcode)}`,
          {
            productType: 'PRODUCT',
            patches: [
              {
                op: 'replace',
                path: '/attributes/fulfillment_availability',
                value: [
                  {
                    fulfillment_channel_code: 'DEFAULT',
                    quantity: u.quantity,
                  },
                ],
              },
            ],
          },
          { params: { marketplaceIds: AMAZON_TR_MARKETPLACE_ID } },
        );
      } catch (error) {
        this.logger.warn('Amazon stok güncellemesi başarısız', {
          sku: u.barcode,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const token = await this.getLwaToken(credentials);
    const client = this.getClient(token);
    const sellerId = credentials.sellerId;
    for (const u of updates) {
      try {
        await client.patch(
          `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(u.barcode)}`,
          {
            productType: 'PRODUCT',
            patches: [
              {
                op: 'replace',
                path: '/attributes/purchasable_offer',
                value: [
                  {
                    currency: 'TRY',
                    our_price: [
                      {
                        schedule: [{ value_with_tax: u.salePrice }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { params: { marketplaceIds: AMAZON_TR_MARKETPLACE_ID } },
        );
      } catch (error) {
        this.logger.warn('Amazon fiyat güncellemesi başarısız', {
          sku: u.barcode,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
