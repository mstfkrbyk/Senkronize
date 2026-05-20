import axios, { type AxiosInstance, isAxiosError } from 'axios';
import type {
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

type AmazonOrderLine = MarketplaceOrder['items'][number];

import { AmazonSpApiAuth } from './amazon-sp-api.auth';

export { AmazonSpApiAuth, configureAmazonSpApiCache } from './amazon-sp-api.auth';
import { AMAZON_REPORT_TYPE_ALL_ORDERS } from './amazon.constants';
import type {
  AmazonCatalogItemsResponse,
  AmazonConfirmShipmentBody,
  AmazonCreateReportResponse,
  AmazonFeedDocumentResponse,
  AmazonFeedResponse,
  AmazonListingsListResponse,
  AmazonListingItem,
  AmazonOrderItemPayload,
  AmazonOrderItemsResponse,
  AmazonOrderPayload,
  AmazonOrdersListResponse,
  AmazonReportDocumentResponse,
  AmazonReportStatusResponse,
} from './amazon.types';

export {
  amazonResolveLwaCredentials,
  amazonResolveAwsCredentials,
  amazonResolveMarketplaceId,
} from './amazon-sp-api.credentials';

export function createAmazonSpApiAuth(
  credentials: Record<string, string>,
  spBaseUrl: string,
  awsRegion = 'eu-west-1',
): AmazonSpApiAuth {
  return new AmazonSpApiAuth(credentials, spBaseUrl, awsRegion);
}

export async function amazonGetLwaToken(
  credentials: Record<string, string>,
  spBaseUrl: string,
  awsRegion = 'eu-west-1',
): Promise<string> {
  const auth = createAmazonSpApiAuth(credentials, spBaseUrl, awsRegion);
  return auth.getAccessTokenFromCredentials(credentials);
}

export function amazonCreateSpClient(
  credentials: Record<string, string>,
  accessToken: string,
  baseUrl: string,
  awsRegion = 'eu-west-1',
): AxiosInstance {
  const auth = createAmazonSpApiAuth(credentials, baseUrl, awsRegion);
  return auth.createSignedClient(accessToken);
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

const AMAZON_ORDER_PAGE_SIZE = 100;
const AMAZON_ORDER_STATUSES = [
  'Unshipped',
  'PartiallyShipped',
  'Shipped',
  'Pending',
] as const;

export async function amazonGetOrdersForMarketplace(
  client: AxiosInstance,
  marketplaceId: string,
  defaultCurrency: string,
  since?: Date,
): Promise<MarketplaceOrder[]> {
  const createdAfter = since
    ? since.toISOString()
    : new Date(Date.now() - 7 * 86400000).toISOString();

  const mapped: MarketplaceOrder[] = [];
  let nextToken: string | undefined;

  try {
    do {
      const q = new URLSearchParams();
      q.append('MarketplaceIds', marketplaceId);
      q.append('CreatedAfter', createdAfter);
      q.append('MaxResultsPerPage', String(AMAZON_ORDER_PAGE_SIZE));
      for (const status of AMAZON_ORDER_STATUSES) {
        q.append('OrderStatuses', status);
      }
      if (nextToken) {
        q.append('NextToken', nextToken);
      }

      const { data } = await client.get<AmazonOrdersListResponse>('/orders/v0/orders', {
        params: q,
      });
      const orders: AmazonOrderPayload[] = data.payload?.Orders ?? [];
      for (const o of orders) {
        const items = await amazonFetchOrderItems(client, o.AmazonOrderId);
        mapped.push(amazonMapOrder(o, items, defaultCurrency));
      }
      nextToken = data.payload?.NextToken;
    } while (typeof nextToken === 'string' && nextToken.length > 0);

    return mapped;
  } catch (error) {
    throw amazonToApiError('sipariş listesi', error);
  }
}

export interface AmazonShipmentNotifyInput {
  packageReferenceId: string;
  trackingNumber: string;
  shipDate: string;
  carrierCode: string;
  shipMethod?: string;
}

/** Sipariş kargo bildirimi — POST /orders/v0/orders/{orderId}/shipment */
export async function amazonConfirmShipment(
  client: AxiosInstance,
  orderId: string,
  input: AmazonShipmentNotifyInput,
): Promise<void> {
  const body: AmazonConfirmShipmentBody = {
    packageDetail: {
      packageReferenceId: input.packageReferenceId,
      trackingNumber: input.trackingNumber,
      shipDate: input.shipDate,
      carrierCode: input.carrierCode,
      shipMethod: input.shipMethod,
    },
  };
  try {
    await client.post(
      `/orders/v0/orders/${encodeURIComponent(orderId)}/shipment`,
      body,
    );
  } catch (error) {
    throw amazonToApiError('kargo bildirimi', error);
  }
}

/** Catalog Items API — ASIN veya SKU ile arama */
export async function amazonGetCatalogByIdentifiers(
  client: AxiosInstance,
  marketplaceId: string,
  identifiers: string[],
  identifierType: 'ASIN' | 'SKU' = 'ASIN',
): Promise<MarketplaceListing[]> {
  if (identifiers.length === 0) {
    return [];
  }
  try {
    const { data } = await client.get<AmazonCatalogItemsResponse>(
      '/catalog/2022-04-01/items',
      {
        params: {
          marketplaceIds: marketplaceId,
          identifiers: identifiers.join(','),
          identifiersType: identifierType,
          includedData: 'summaries,images',
        },
      },
    );
    const catalogItems = data.items ?? [];
    return catalogItems.map((item) =>
      amazonMapCatalogItem(item.asin ?? identifiers[0] ?? '', item),
    );
  } catch (error) {
    throw amazonToApiError('katalog kimlik araması', error);
  }
}

/** Listings Items API — tek SKU detayı */
export async function amazonGetListingItem(
  client: AxiosInstance,
  sellerId: string,
  sku: string,
  marketplaceId: string,
): Promise<MarketplaceListing | null> {
  try {
    const { data } = await client.get<AmazonListingItem>(
      `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}`,
      { params: { marketplaceIds: marketplaceId, includedData: 'summaries,offers' } },
    );
    return amazonMapListingItem(data);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw amazonToApiError('listeleme detayı', error);
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
    const byAsin = await amazonGetCatalogByIdentifiers(
      client,
      marketplaceId,
      [keyword],
      'ASIN',
    );
    if (byAsin.length > 0) {
      return { items: byAsin, total: byAsin.length, page, pageSize: 50 };
    }
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
      `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}`,
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

function buildStockListingBody(quantity: number): {
  productType: string;
  patches: Array<{ op: string; path: string; value: unknown[] }>;
} {
  return {
    productType: 'PRODUCT',
    patches: [
      {
        op: 'replace',
        path: '/attributes/item_quantity',
        value: [{ value: Math.max(0, Math.round(quantity)) }],
      },
    ],
  };
}

function buildPriceListingBody(
  salePrice: number,
  currency: string,
): {
  productType: string;
  patches: Array<{ op: string; path: string; value: unknown[] }>;
} {
  return {
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
                schedule: [{ value_with_tax: salePrice }],
              },
            ],
          },
        ],
      },
    ],
  };
}

async function amazonPutListingItem(
  client: AxiosInstance,
  sellerId: string,
  sku: string,
  marketplaceId: string,
  body: { productType: string; patches: Array<{ op: string; path: string; value: unknown[] }> },
): Promise<void> {
  await client.put(
    `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}`,
    body,
    { params: { marketplaceIds: marketplaceId } },
  );
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

  for (const u of updates) {
    try {
      await amazonPutListingItem(
        client,
        sellerId,
        u.barcode,
        marketplaceId,
        buildStockListingBody(u.quantity),
      );
    } catch (putError) {
      const putMessage =
        putError instanceof Error ? putError.message : 'PUT listeleme başarısız';
      try {
        await client.patch(
          `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(u.barcode)}`,
          buildStockListingBody(u.quantity),
          { params: { marketplaceIds: marketplaceId } },
        );
      } catch (patchError) {
        onItemError(
          u.barcode,
          `${putMessage}; PATCH: ${
            patchError instanceof Error ? patchError.message : 'Bilinmeyen hata'
          }`,
        );
      }
    }
  }

  if (updates.length <= 3) {
    return;
  }

  const contentType = 'text/tab-separated-values; charset=UTF-8';
  try {
    const doc = await amazonCreateFeedDocument(client, contentType);
    const tsv = buildInventoryFeedTsv(updates);
    await amazonUploadFeedDocument(doc.url, tsv, contentType);
    await amazonCreateInventoryFeed(client, marketplaceId, doc.feedDocumentId);
  } catch {
    // Toplu feed isteğe bağlı; tekil PUT/PATCH yukarıda denendi
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
      await amazonPutListingItem(
        client,
        sellerId,
        u.barcode,
        marketplaceId,
        buildPriceListingBody(u.salePrice, currency),
      );
    } catch (putError) {
      const putMessage =
        putError instanceof Error ? putError.message : 'PUT fiyat başarısız';
      try {
        await client.patch(
          `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(u.barcode)}`,
          buildPriceListingBody(u.salePrice, currency),
          { params: { marketplaceIds: marketplaceId } },
        );
      } catch (patchError) {
        onItemError(
          u.barcode,
          `${putMessage}; PATCH: ${
            patchError instanceof Error ? patchError.message : 'Bilinmeyen hata'
          }`,
        );
      }
    }
  }
}

const REPORT_POLL_INTERVAL_MS = 5_000;
const REPORT_POLL_MAX_ATTEMPTS = 60;

/** Satış raporu isteği oluşturur */
export async function amazonCreateSalesReport(
  client: AxiosInstance,
  marketplaceId: string,
  dataStartTime?: string,
  dataEndTime?: string,
): Promise<string> {
  try {
    const { data } = await client.post<AmazonCreateReportResponse>(
      '/reports/2021-06-30/reports',
      {
        reportType: AMAZON_REPORT_TYPE_ALL_ORDERS,
        marketplaceIds: [marketplaceId],
        dataStartTime,
        dataEndTime,
      },
    );
    if (!data.reportId) {
      throw new Error('Amazon rapor kimliği alınamadı');
    }
    return data.reportId;
  } catch (error) {
    throw amazonToApiError('rapor oluşturma', error);
  }
}

/** Rapor durumunu kontrol eder */
export async function amazonGetReportStatus(
  client: AxiosInstance,
  reportId: string,
): Promise<AmazonReportStatusResponse> {
  try {
    const { data } = await client.get<AmazonReportStatusResponse>(
      `/reports/2021-06-30/reports/${encodeURIComponent(reportId)}`,
    );
    return data;
  } catch (error) {
    throw amazonToApiError('rapor durumu', error);
  }
}

/** Rapor belgesi indirme URL'sini alır */
export async function amazonGetReportDocument(
  client: AxiosInstance,
  reportDocumentId: string,
): Promise<AmazonReportDocumentResponse> {
  try {
    const { data } = await client.get<AmazonReportDocumentResponse>(
      `/reports/2021-06-30/documents/${encodeURIComponent(reportDocumentId)}`,
    );
    if (!data.url) {
      throw new Error('Amazon rapor indirme URL yok');
    }
    return data;
  } catch (error) {
    throw amazonToApiError('rapor belgesi', error);
  }
}

/** Rapor hazır olana kadar bekler ve ham içeriği indirir */
export async function amazonDownloadSalesReport(
  client: AxiosInstance,
  marketplaceId: string,
  dataStartTime?: string,
  dataEndTime?: string,
): Promise<string> {
  const reportId = await amazonCreateSalesReport(
    client,
    marketplaceId,
    dataStartTime,
    dataEndTime,
  );

  let reportDocumentId: string | undefined;
  for (let attempt = 0; attempt < REPORT_POLL_MAX_ATTEMPTS; attempt += 1) {
    const status = await amazonGetReportStatus(client, reportId);
    const processing = status.processingStatus?.toUpperCase() ?? '';
    if (processing === 'DONE' && status.reportDocumentId) {
      reportDocumentId = status.reportDocumentId;
      break;
    }
    if (processing === 'FATAL' || processing === 'CANCELLED') {
      throw new Error(`Amazon rapor işleme başarısız: ${processing}`);
    }
    await new Promise((resolve) => setTimeout(resolve, REPORT_POLL_INTERVAL_MS));
  }

  if (!reportDocumentId) {
    throw new Error('Amazon rapor zaman aşımı');
  }

  const doc = await amazonGetReportDocument(client, reportDocumentId);
  const { data: raw } = await axios.get<ArrayBuffer>(doc.url, {
    responseType: 'arraybuffer',
    timeout: 120_000,
  });

  if (doc.compressionAlgorithm?.toUpperCase() === 'GZIP') {
    const zlib = await import('zlib');
    const buf = Buffer.from(raw);
    const decompressed = zlib.gunzipSync(buf);
    return decompressed.toString('utf8');
  }

  return Buffer.from(raw).toString('utf8');
}
