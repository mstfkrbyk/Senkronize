import axios, { type AxiosInstance } from 'axios';
import type {
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { AMAZON_LWA_URL, AMAZON_SP_BASE_URL } from './amazon.constants';
import type {
  AmazonListingsListResponse,
  AmazonListingItem,
  AmazonLwaTokenResponse,
  AmazonOrderPayload,
  AmazonOrdersListResponse,
} from './amazon.types';

export async function amazonGetLwaToken(
  credentials: Record<string, string>,
): Promise<string> {
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

export function amazonCreateSpClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: AMAZON_SP_BASE_URL,
    headers: {
      'x-amz-access-token': token,
      'Content-Type': 'application/json',
    },
    timeout: 20_000,
  });
}

export function amazonResolveMarketplaceId(
  credentials: Record<string, string>,
  fallback: string,
): string {
  const raw = credentials.marketplaceId?.trim();
  return raw && raw.length > 0 ? raw : fallback;
}

export function amazonMapOrder(
  o: AmazonOrderPayload,
  defaultCurrency: string,
): MarketplaceOrder {
  const buyerName = o.BuyerInfo?.BuyerName ?? '';
  const amount = parseFloat(o.OrderTotal?.Amount ?? '0');
  return {
    platformOrderId: o.AmazonOrderId,
    status: o.OrderStatus ?? 'Pending',
    customerName: buyerName.length > 0 ? buyerName : '—',
    items: [],
    totalAmount: Number.isFinite(amount) ? amount : 0,
    currency: o.OrderTotal?.CurrencyCode ?? defaultCurrency,
    createdAt: o.PurchaseDate
      ? new Date(o.PurchaseDate).toISOString()
      : new Date().toISOString(),
    cargoTrackingNumber: undefined,
    cargoProvider: undefined,
  };
}

export function amazonMapListingItem(i: AmazonListingItem): MarketplaceListing {
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
}

export async function amazonGetOrdersForMarketplace(
  client: AxiosInstance,
  marketplaceId: string,
  defaultCurrency: string,
  since?: Date,
): Promise<MarketplaceOrder[]> {
  const createdAfter = since
    ? since.toISOString()
    : new Date(Date.now() - 7 * 86400000).toISOString();
  const q = new URLSearchParams();
  q.append('MarketplaceIds', marketplaceId);
  q.append('CreatedAfter', createdAfter);
  for (const status of ['Unshipped', 'Shipped', 'PartiallyShipped'] as const) {
    q.append('OrderStatuses', status);
  }
  const { data } = await client.get<AmazonOrdersListResponse>('/orders/v0/orders', {
    params: q,
  });
  const orders: AmazonOrderPayload[] = data.payload?.Orders ?? [];
  return orders.map((o) => amazonMapOrder(o, defaultCurrency));
}

export async function amazonGetListingsForMarketplace(
  client: AxiosInstance,
  sellerId: string,
  marketplaceId: string,
  page: number,
): Promise<PaginatedResult<MarketplaceListing>> {
  const { data } = await client.get<AmazonListingsListResponse>(
    `/listings/2021-08-01/items/${sellerId}`,
    {
      params: {
        marketplaceIds: marketplaceId,
        pageSize: 50,
      },
    },
  );
  const items = data.items ?? [];
  const rows: MarketplaceListing[] = items.map((i) => amazonMapListingItem(i));
  return {
    items: rows,
    total: rows.length,
    page,
    pageSize: 50,
  };
}

export async function amazonUpdateStockForMarketplace(
  client: AxiosInstance,
  sellerId: string,
  marketplaceId: string,
  updates: StockUpdatePayload[],
  onItemError: (sku: string, message: string) => void,
): Promise<void> {
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
        { params: { marketplaceIds: marketplaceId } },
      );
    } catch (error) {
      onItemError(
        u.barcode,
        error instanceof Error ? error.message : 'Bilinmeyen hata',
      );
    }
  }
}

export async function amazonUpdatePriceForMarketplace(
  client: AxiosInstance,
  sellerId: string,
  marketplaceId: string,
  currency: string,
  updates: PriceUpdatePayload[],
  onItemError: (sku: string, message: string) => void,
): Promise<void> {
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
                  currency,
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
        { params: { marketplaceIds: marketplaceId } },
      );
    } catch (error) {
      onItemError(
        u.barcode,
        error instanceof Error ? error.message : 'Bilinmeyen hata',
      );
    }
  }
}
