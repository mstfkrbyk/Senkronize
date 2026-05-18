import { Injectable, Logger } from '@nestjs/common';
import type { AxiosRequestConfig } from 'axios';
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
import { parseMoney } from '../stub-helpers';
import type {
  IkasGraphqlResponse,
  IkasListOrderData,
  IkasListProductData,
  IkasListStockLocationData,
  IkasOrderRow,
  IkasProductRow,
  IkasTokenResponse,
  IkasVariantRow,
} from './ikas.types';

const IKAS_OAUTH_URL = 'https://api.myikas.com/api/admin/oauth/token';
const IKAS_GRAPHQL_V2 = 'https://api.myikas.com/api/v2/admin/graphql';
const IKAS_GRAPHQL_V1 = 'https://api.myikas.com/api/v1/admin/graphql';

const LIST_ORDER_QUERY = `
query listOrder($pagination: PaginationInput, $search: String, $orderedAt: DateFilterInput, $sort: String) {
  listOrder(pagination: $pagination, search: $search, orderedAt: $orderedAt, sort: $sort) {
    count
    data {
      id
      orderNumber
      orderedAt
      status
      totalFinalPrice
      currencyCode
    }
    hasNext
    limit
    page
  }
}`;

const LIST_PRODUCT_QUERY = `
query listProduct($pagination: PaginationInput, $search: String) {
  listProduct(pagination: $pagination, search: $search) {
    count
    data {
      id
      name
      totalStock
      variants { id sku stockQuantity }
    }
    hasNext
    limit
    page
  }
}`;

const LIST_STOCK_LOCATIONS_V1 = `
query { listStockLocation { id name } }`;

const SAVE_VARIANT_STOCKS = `
mutation SaveVariantStocks($input: SaveVariantStocksInput!) {
  saveVariantStocks(input: $input) {
    isSuccess
    errorInputs { variantId productId }
  }
}`;

const UPDATE_VARIANT_PRICES = `
mutation UpdateVariantPrices($input: UpdateVariantPricesInput!) {
  updateVariantPrices(input: $input) {
    isSuccess
    errorInputs { priceListId productId variantId }
  }
}`;

@Injectable()
export class IkasAdapter implements IMarketplaceAdapter {
  readonly platform = 'IKAS';
  private readonly logger = new Logger(IkasAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.IKAS ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private async fetchAccessToken(
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString();
    const data = await axiosWithRetry<IkasTokenResponse>(
      {
        method: 'POST',
        url: IKAS_OAUTH_URL,
        data: body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20_000,
      },
      { maxRetries: 2 },
    );
    const token = data.access_token;
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('İkas: access_token alınamadı');
    }
    return token;
  }

  private gqlHeaders(token: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
  }

  private async postGqlV2<T>(
    token: string,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const res = await axiosWithRetry<IkasGraphqlResponse<T>>(
      {
        method: 'POST',
        url: IKAS_GRAPHQL_V2,
        data: { query, variables },
        timeout: 30_000,
        ...this.gqlHeaders(token),
      },
      { maxRetries: 2 },
    );
    if (Array.isArray(res.errors) && res.errors.length > 0) {
      const msg = res.errors.map((e) => e.message).join('; ');
      throw new Error(`İkas GraphQL: ${msg}`);
    }
    if (res.data === undefined) {
      throw new Error('İkas GraphQL: boş yanıt');
    }
    return res.data;
  }

  private async postGqlV1<T>(
    token: string,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const res = await axiosWithRetry<IkasGraphqlResponse<T>>(
      {
        method: 'POST',
        url: IKAS_GRAPHQL_V1,
        data: { query, variables },
        timeout: 30_000,
        ...this.gqlHeaders(token),
      },
      { maxRetries: 2 },
    );
    if (Array.isArray(res.errors) && res.errors.length > 0) {
      const msg = res.errors.map((e) => e.message).join('; ');
      throw new Error(`İkas GraphQL: ${msg}`);
    }
    if (res.data === undefined) {
      throw new Error('İkas GraphQL: boş yanıt');
    }
    return res.data;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const clientId = credentials.clientId?.trim();
      const clientSecret = credentials.clientSecret?.trim();
      if (!clientId || !clientSecret) {
        return false;
      }
      const token = await this.fetchAccessToken(clientId, clientSecret);
      await this.postGqlV2<{ me?: { id?: string } }>(
        token,
        'query { me { id } }',
        undefined,
      );
      return true;
    } catch (error) {
      this.logger.warn('İkas bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private async getToken(credentials: Record<string, string>): Promise<string | null> {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    if (!clientId || !clientSecret) {
      return null;
    }
    return await this.fetchAccessToken(clientId, clientSecret);
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const token = await this.getToken(credentials);
    if (!token) {
      return [];
    }
    const sinceDate = since ?? new Date(Date.now() - 7 * 86_400_000);
    const gt = sinceDate.getTime();
    try {
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await this.postGqlV2<IkasListOrderData>(token, LIST_ORDER_QUERY, {
          orderedAt: { gt },
          pagination: { limit: 50, page: 1 },
          sort: '-orderedAt',
        });
      });
      const rows = data.listOrder?.data ?? [];
      return rows.map((o) => this.mapOrder(o));
    } catch (error) {
      this.logger.warn('İkas sipariş çekme başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  private mapOrder(o: IkasOrderRow): MarketplaceOrder {
    const total = Number(o.totalFinalPrice ?? 0);
    return {
      platformOrderId: String(o.orderNumber ?? o.id ?? ''),
      status: String(o.status ?? ''),
      customerName: '—',
      items: [],
      totalAmount: Number.isFinite(total) ? total : 0,
      currency: String(o.currencyCode ?? 'TRY'),
      createdAt: new Date(o.orderedAt ?? Date.now()).toISOString(),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const token = await this.getToken(credentials);
    if (!token) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const pageSize = 50;
    try {
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await this.postGqlV2<IkasListProductData>(token, LIST_PRODUCT_QUERY, {
          pagination: { limit: pageSize, page: page + 1 },
          search: '',
        });
      });
      const block = data.listProduct;
      const rows = block?.data ?? [];
      const items = rows
        .map((p) => this.mapProduct(p))
        .filter((l): l is MarketplaceListing => l !== null);
      const total = block?.count ?? items.length;
      return { items, total, page, pageSize };
    } catch (error) {
      this.logger.warn('İkas ürün listesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }

  private mapProduct(p: IkasProductRow): MarketplaceListing | null {
    const id = p.id;
    if (id === undefined || id.length === 0) {
      return null;
    }
    const variants = p.variants ?? [];
    const primary = variants[0];
    const sku = String(primary?.sku ?? id);
    const qty =
      typeof p.totalStock === 'number' && Number.isFinite(p.totalStock)
        ? p.totalStock
        : parseMoney(primary?.stockQuantity);
    return {
      platformProductId: id,
      barcode: sku,
      title: String(p.name ?? sku),
      quantity: qty,
      salePrice: 0,
      listPrice: 0,
      approved: true,
      images: [],
    };
  }

  private async resolveDefaultStockLocationId(token: string): Promise<string | null> {
    try {
      const data = await this.postGqlV2<{ listStockLocation?: Array<{ id?: string }> }>(
        token,
        'query { listStockLocation { id name } }',
        undefined,
      );
      const first = data.listStockLocation?.[0];
      if (first?.id) {
        return first.id;
      }
    } catch {
      /* v2 yoksa v1 dene */
    }
    const data = await this.postGqlV1<IkasListStockLocationData>(
      token,
      LIST_STOCK_LOCATIONS_V1,
      undefined,
    );
    return data.listStockLocation?.[0]?.id ?? null;
  }

  private async findVariantForBarcode(
    token: string,
    barcode: string,
  ): Promise<{ productId: string; variantId: string } | null> {
    const data = await this.postGqlV2<IkasListProductData>(token, LIST_PRODUCT_QUERY, {
      pagination: { limit: 50, page: 1 },
      search: barcode,
    });
    const rows = data.listProduct?.data ?? [];
    for (const p of rows) {
      const pid = p.id;
      if (!pid) {
        continue;
      }
      const variants = p.variants ?? [];
      const hit = variants.find(
        (v: IkasVariantRow) =>
          String(v.sku ?? '').toLowerCase() === barcode.toLowerCase(),
      );
      if (hit?.id) {
        return { productId: pid, variantId: hit.id };
      }
    }
    return null;
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const token = await this.getToken(credentials);
    if (!token) {
      return;
    }
    const stockLocationId =
      credentials.stockLocationId?.trim() ??
      (await this.resolveDefaultStockLocationId(token));
    if (!stockLocationId) {
      this.logger.warn(
        'İkas stok güncellemesi: stockLocationId eksik ve varsayılan depo bulunamadı',
      );
      return;
    }
    for (const u of updates) {
      const barcode = u.barcode.trim();
      if (!barcode) {
        continue;
      }
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          const found = await this.findVariantForBarcode(token, barcode);
          if (!found) {
            return;
          }
          await this.postGqlV2<{
            saveVariantStocks?: { isSuccess?: boolean };
          }>(token, SAVE_VARIANT_STOCKS, {
            input: {
              stockInputs: [
                {
                  deleted: false,
                  productId: found.productId,
                  variantId: found.variantId,
                  stockLocationId,
                  stockCount: u.quantity,
                },
              ],
            },
          });
        });
      } catch (error) {
        this.logger.warn('İkas stok güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const token = await this.getToken(credentials);
    if (!token) {
      return;
    }
    const priceListIdRaw = credentials.priceListId?.trim();
    const priceListId =
      priceListIdRaw && priceListIdRaw.length > 0 ? priceListIdRaw : null;
    for (const u of updates) {
      const barcode = u.barcode.trim();
      if (!barcode) {
        continue;
      }
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          const found = await this.findVariantForBarcode(token, barcode);
          if (!found) {
            return;
          }
          await this.postGqlV2<{
            updateVariantPrices?: { isSuccess?: boolean };
          }>(token, UPDATE_VARIANT_PRICES, {
            input: {
              priceListId,
              variantPriceInputs: [
                {
                  deleted: false,
                  price: {
                    sellPrice: u.salePrice,
                    currency: 'TRY',
                  },
                  productId: found.productId,
                  variantId: found.variantId,
                },
              ],
            },
          });
        });
      } catch (error) {
        this.logger.warn('İkas fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
