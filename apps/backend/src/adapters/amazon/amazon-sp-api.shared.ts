import axios, { type AxiosInstance, isAxiosError } from 'axios';
import type {
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

type AmazonOrderLine = MarketplaceOrder['items'][number];

import { AMAZON_LWA_URL, AMAZON_SP_BASE_URL } from './amazon.constants';
import { signAmazonSpApiRequest } from './amazon-sp-api-sigv4';
import type {
  AmazonCatalogItemsResponse,
  AmazonFeedDocumentResponse,
  AmazonFeedResponse,
  AmazonListingsListResponse,
  AmazonListingItem,
  AmazonLwaTokenResponse,
  AmazonOrderItemPayload,
  AmazonOrderItemsResponse,
  AmazonOrderPayload,
  AmazonOrdersListResponse,
} from './amazon.types';

export function amazonResolveLwaCredentials(credentials: Record<string, string>): {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} {
  const clientId =
    credentials.clientId?.trim() ||
    credentials.lwaClientId?.trim() ||
    '';
  const clientSecret =
    credentials.clientSecret?.trim() ||
    credentials.lwaClientSecret?.trim() ||
    '';
  const refreshToken = credentials.refreshToken?.trim() ?? '';
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Amazon: clientId, clientSecret ve refreshToken (LWA) zorunludur',
    );
  }
  return { clientId, clientSecret, refreshToken };
}

export function amazonResolveAwsCredentials(credentials: Record<string, string>): {
  accessKeyId: string;
  secretAccessKey: string;
} {
  const accessKeyId = credentials.accessKeyId?.trim() ?? '';
  const secretAccessKey = credentials.secretAccessKey?.trim() ?? '';
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Amazon: accessKeyId ve secretAccessKey (IAM) zorunludur');
  }
  return { accessKeyId, secretAccessKey };
}

export async function amazonGetLwaToken(
  credentials: Record<string, string>,
): Promise<string> {
  const { clientId, clientSecret, refreshToken } =
    amazonResolveLwaCredentials(credentials);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  try {
    const { data } = await axios.post<AmazonLwaTokenResponse>(AMAZON_LWA_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20_000,
    });
    if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
      throw new Error('Amazon LWA yanıtında access_token yok');
    }
    return data.access_token;
  } catch (error) {
    throw amazonToApiError('LWA token', error);
  }
}

export function amazonCreateSpClient(
  credentials: Record<string, string>,
  accessToken: string,
  baseUrl: string = AMAZON_SP_BASE_URL,
): AxiosInstance {
  const { accessKeyId, secretAccessKey } = amazonResolveAwsCredentials(credentials);
  const client = axios.create({
    baseURL: baseUrl,
    headers: {
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json',
    },
    timeout: 30_000,
  });
  client.interceptors.request.use((config) =>
    signAmazonSpApiRequest(config, accessKeyId, secretAccessKey, baseUrl),
  );
  return client;
}

export function amazonResolveMarketplaceId(
  credentials: Record<string, string>,
  fallback: string,
): string {
  const raw = credentials.marketplaceId?.trim();
  return raw && raw.length > 0 ? raw : fallback;
}

function amazonToApiError(context: string, error: unknown): Error {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    let detail = error.message;
    if (typeof data === 'object' && data !== null) {
      const errors = (data as { errors?: Array<{ message?: string }> }).errors;
      if (Array.isArray(errors) && errors[0]?.message) {
        detail = errors[0].message;
      } else if ('message' in data && typeof data.message === 'string') {
        detail = data.message;
      }
    }
    return new Error(
      `Amazon SP-API ${context}${status != null ? ` (${String(status)})` : ''}: ${detail}`,
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(`Amazon SP-API ${context}: Bilinmeyen hata`);
}

export function amazonMapOrderItem(item: AmazonOrderItemPayload): AmazonOrderLine {
  const sku = item.SellerSKU ?? item.ASIN ?? '';
  const qty = item.QuantityOrdered ?? 0;
  const price = parseFloat(item.ItemPrice?.Amount ?? '0');
  return {
    sku,
    barcode: sku,
    quantity: Number.isFinite(qty) ? Math.max(0, Math.round(qty)) : 0,
    unitPrice: Number.isFinite(price) ? price : 0,
    platformItemId: item.OrderItemId ?? sku,
    productName: item.Title,
  };
}

export function amazonMapOrder(
  o: AmazonOrderPayload,
  items: AmazonOrderLine[],
  defaultCurrency: string,
): MarketplaceOrder {
  const buyerName = o.BuyerInfo?.BuyerName ?? '';
  const amount = parseFloat(o.OrderTotal?.Amount ?? '0');
  return {
    platformOrderId: o.AmazonOrderId,
    status: o.OrderStatus ?? 'Pending',
    customerName: buyerName.length > 0 ? buyerName : '—',
    items,
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

export function amazonMapCatalogItem(
  asin: string,
  item: NonNullable<AmazonCatalogItemsResponse['items']>[number],
): MarketplaceListing {
  const summary = item.summaries?.[0];
  const title = summary?.itemName ?? asin;
  const image = summary?.mainImage?.link;
  return {
    platformProductId: asin,
    barcode: asin,
    title,
    quantity: 0,
    salePrice: 0,
    listPrice: 0,
    approved: true,
    images: typeof image === 'string' && image.length > 0 ? [image] : [],
  };
}

async function amazonFetchOrderItems(
  client: AxiosInstance,
  orderId: string,
): Promise<AmazonOrderLine[]> {
  try {
    const { data } = await client.get<AmazonOrderItemsResponse>(
      `/orders/v0/orders/${encodeURIComponent(orderId)}/orderItems`,
    );
    const rows = data.payload?.OrderItems ?? [];
    return rows.map((row) => amazonMapOrderItem(row));
  } catch {
    return [];
  }
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
  for (const status of ['Unshipped', 'PartiallyShipped'] as const) {
    q.append('OrderStatuses', status);
  }
  try {
    const { data } = await client.get<AmazonOrdersListResponse>('/orders/v0/orders', {
      params: q,
    });
    const orders: AmazonOrderPayload[] = data.payload?.Orders ?? [];
    const mapped: MarketplaceOrder[] = [];
    for (const o of orders) {
      const items = await amazonFetchOrderItems(client, o.AmazonOrderId);
      mapped.push(amazonMapOrder(o, items, defaultCurrency));
    }
    return mapped;
  } catch (error) {
    throw amazonToApiError('sipariş listesi', error);
  }
}

export async function amazonGetListingsForMarketplace(
  client: AxiosInstance,
  sellerId: string,
  marketplaceId: string,
  page: number,
  searchKeyword?: string,
): Promise<PaginatedResult<MarketplaceListing>> {
  const keyword = searchKeyword?.trim();
  if (keyword && keyword.length > 0) {
    try {
      const { data } = await client.get<AmazonCatalogItemsResponse>(
        '/catalog/2022-04-01/items',
        {
          params: {
            marketplaceIds: marketplaceId,
            keywords: keyword,
            pageSize: 50,
            pageToken: page > 0 ? String(page) : undefined,
          },
        },
      );
      const catalogItems = data.items ?? [];
      const rows: MarketplaceListing[] = catalogItems.map((item) =>
        amazonMapCatalogItem(item.asin ?? '', item),
      );
      return {
        items: rows,
        total: rows.length,
        page,
        pageSize: 50,
      };
    } catch (error) {
      throw amazonToApiError('katalog araması', error);
    }
  }

  try {
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
  } catch (error) {
    throw amazonToApiError('ürün listesi', error);
  }
}

async function amazonCreateFeedDocument(
  client: AxiosInstance,
  contentType: string,
): Promise<AmazonFeedDocumentResponse> {
  const { data } = await client.post<AmazonFeedDocumentResponse>(
    '/feeds/2021-06-30/documents',
    { contentType },
  );
  if (!data.feedDocumentId || !data.url) {
    throw new Error('Amazon feed belgesi oluşturulamadı');
  }
  return data;
}

async function amazonUploadFeedDocument(
  uploadUrl: string,
  body: string,
  contentType: string,
): Promise<void> {
  await axios.put(uploadUrl, body, {
    headers: { 'Content-Type': contentType },
    timeout: 60_000,
  });
}

async function amazonCreateInventoryFeed(
  client: AxiosInstance,
  sellerId: string,
  marketplaceId: string,
  feedDocumentId: string,
): Promise<string> {
  const { data } = await client.post<AmazonFeedResponse>('/feeds/2021-06-30/feeds', {
    feedType: 'POST_FLAT_FILE_INVLOADER_DATA',
    marketplaceIds: [marketplaceId],
    inputFeedDocumentId: feedDocumentId,
  });
  if (!data.feedId) {
    throw new Error('Amazon stok feed kaydı oluşturulamadı');
  }
  void sellerId;
  return data.feedId;
}

function buildInventoryFeedTsv(updates: StockUpdatePayload[]): string {
  const lines = ['sku\tquantity'];
  for (const u of updates) {
    lines.push(`${u.barcode}\t${String(Math.max(0, Math.round(u.quantity)))}`);
  }
  return lines.join('\n');
}

export async function amazonUpdateStockForMarketplace(
  client: AxiosInstance,
  sellerId: string,
  marketplaceId: string,
  updates: StockUpdatePayload[],
  onItemError: (sku: string, message: string) => void,
): Promise<void> {
  if (updates.length === 0) {
    return;
  }
  const contentType = 'text/tab-separated-values; charset=UTF-8';
  try {
    const doc = await amazonCreateFeedDocument(client, contentType);
    const tsv = buildInventoryFeedTsv(updates);
    await amazonUploadFeedDocument(doc.url, tsv, contentType);
    await amazonCreateInventoryFeed(
      client,
      sellerId,
      marketplaceId,
      doc.feedDocumentId,
    );
  } catch (feedError) {
    const feedMessage =
      feedError instanceof Error ? feedError.message : 'Feed gönderimi başarısız';
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
          `${feedMessage}; yedek patch: ${
            error instanceof Error ? error.message : 'Bilinmeyen hata'
          }`,
        );
      }
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
