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
import {
  isRecord,
  normalizeProductRows,
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import {
  EBAY_DEFAULT_CURRENCY,
  EBAY_FULFILLMENT_BASE,
  EBAY_INVENTORY_BASE,
  EBAY_MARKETPLACE_ID,
} from './ebay.constants';
import { refreshEbayAccessToken } from './ebay.oauth';
import type {
  EbayFulfillmentLineItem,
  EbayFulfillmentOrder,
  EbayInventoryItemPayload,
  EbayOffersBySkuResponse,
  EbayOrdersResponse,
  EbayShippingFulfillmentPayload,
} from './ebay.types';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const ORDER_FULFILLMENT_FILTER = 'NOT_STARTED|IN_PROGRESS';

@Injectable()
export class EbayAdapter implements IMarketplaceAdapter {
  readonly platform = 'EBAY';
  private readonly logger = new Logger(EbayAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.EBAY ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private resolveClientCredentials(credentials: Record<string, string>): {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  } {
    const clientId = credentials.clientId?.trim() ?? '';
    const clientSecret = credentials.clientSecret?.trim() ?? '';
    const refreshToken = credentials.refreshToken?.trim() ?? '';
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'eBay: clientId, clientSecret ve refreshToken (veya geçerli accessToken) zorunludur',
      );
    }
    return { clientId, clientSecret, refreshToken };
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const direct = credentials.accessToken?.trim();
    const expiresRaw = credentials.tokenExpiresAt?.trim();
    if (direct && expiresRaw) {
      const expiresAt = Number.parseInt(expiresRaw, 10);
      if (Number.isFinite(expiresAt) && Date.now() < expiresAt - TOKEN_REFRESH_BUFFER_MS) {
        return direct;
      }
    } else if (direct && !credentials.refreshToken?.trim()) {
      return direct;
    }

    const { clientId, clientSecret, refreshToken } =
      this.resolveClientCredentials(credentials);
    const tokens = await refreshEbayAccessToken(clientId, clientSecret, refreshToken);
    credentials.accessToken = tokens.accessToken;
    credentials.refreshToken = tokens.refreshToken;
    credentials.tokenExpiresAt = String(tokens.tokenExpiresAt);
    return tokens.accessToken;
  }

  private auth(token: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE_ID,
      },
    };
  }

  private buildOrderDateFilter(since?: Date): string {
    const end = new Date().toISOString();
    const start =
      since !== undefined ? since.toISOString() : new Date(0).toISOString();
    return `creationdate:[${start}..${end}],orderfulfillmentstatus:{${ORDER_FULFILLMENT_FILTER}}`;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const token = await this.getAccessToken(credentials);
      await axiosWithRetry<EbayOrdersResponse>(
        {
          method: 'GET',
          url: `${EBAY_FULFILLMENT_BASE}/order`,
          timeout: 12_000,
          params: { limit: 1, filter: this.buildOrderDateFilter() },
          ...this.auth(token),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('eBay bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapOrder(o: EbayFulfillmentOrder): MarketplaceOrder | null {
    const idRaw = o.orderId;
    if (typeof idRaw !== 'string' || idRaw.length === 0) {
      return null;
    }
    const createdRaw = o.creationDate;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const buyer = o.buyer?.username;
    const customerName =
      typeof buyer === 'string' && buyer.length > 0 ? buyer : '—';
    const lineItems = Array.isArray(o.lineItems) ? o.lineItems : [];
    const totalStr = o.pricingSummary?.total?.value;
    const currency =
      typeof o.pricingSummary?.total?.currency === 'string'
        ? o.pricingSummary.total.currency
        : EBAY_DEFAULT_CURRENCY;
    return {
      platformOrderId: idRaw,
      status:
        typeof o.orderFulfillmentStatus === 'string'
          ? o.orderFulfillmentStatus
          : 'UNKNOWN',
      customerName,
      items: lineItems.map((l: EbayFulfillmentLineItem) => ({
        sku: typeof l.sku === 'string' ? l.sku : String(l.lineItemId ?? ''),
        barcode: typeof l.sku === 'string' ? l.sku : String(l.lineItemId ?? ''),
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.lineItemCost?.value),
        platformItemId:
          typeof l.lineItemId === 'string' ? l.lineItemId : String(l.sku ?? ''),
        productName: typeof l.title === 'string' ? l.title : undefined,
      })),
      totalAmount: parseMoney(totalStr),
      currency,
      createdAt,
    };
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const token = await this.getAccessToken(credentials);
      const url = `${EBAY_FULFILLMENT_BASE}/order`;
      let out: MarketplaceOrder[] = [];
      await withRateLimit('EBAY', this.rpm(), async () => {
        const data = await axiosWithRetry<EbayOrdersResponse>(
          {
            method: 'GET',
            url,
            timeout: 25_000,
            params: {
              limit: 50,
              filter: this.buildOrderDateFilter(since),
            },
            ...this.auth(token),
          },
          {},
        );
        const orders = Array.isArray(data.orders) ? data.orders : [];
        out = orders
          .map((o) => this.mapOrder(o))
          .filter((x): x is MarketplaceOrder => x !== null);
      });
      return out;
    } catch (error) {
      throwSyncFailed('EBAY', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const token = await this.getAccessToken(credentials);
      const url = `${EBAY_INVENTORY_BASE}/inventory_item`;
      const { rows, total } = await withRateLimit('EBAY', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params: { limit: 50, offset: page * 50 },
            ...this.auth(token),
          },
          {},
        );
        return normalizeProductRows(data);
      });
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const sku =
          typeof p.sku === 'string'
            ? p.sku
            : typeof p.SKU === 'string'
              ? p.SKU
              : `row-${i}`;
        const id =
          typeof p.inventoryItemKey === 'string'
            ? p.inventoryItemKey
            : typeof p.sku === 'string'
              ? p.sku
              : sku;
        const avail = isRecord(p.availability) ? p.availability : undefined;
        const qtyRaw = isRecord(avail?.shipToLocationAvailability)
          ? avail.shipToLocationAvailability.quantity
          : p.quantity;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        const product = isRecord(p.product) ? p.product : undefined;
        const title =
          typeof product?.title === 'string'
            ? product.title
            : typeof p.title === 'string'
              ? p.title
              : sku;
        return {
          platformProductId: id,
          barcode: sku,
          title,
          quantity,
          salePrice: 0,
          listPrice: 0,
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
    } catch (error) {
      throwSyncFailed('EBAY', 'getListings', error);
    }
  }

  private async resolveOfferId(
    token: string,
    sku: string,
  ): Promise<string> {
    const data = await axiosWithRetry<EbayOffersBySkuResponse>(
      {
        method: 'GET',
        url: `${EBAY_INVENTORY_BASE}/offer`,
        timeout: 20_000,
        params: { sku, marketplace_id: EBAY_MARKETPLACE_ID },
        ...this.auth(token),
      },
      { maxRetries: 1 },
    );
    const offers = Array.isArray(data.offers) ? data.offers : [];
    const first = offers[0];
    const offerId =
      typeof first?.offerId === 'string' ? first.offerId.trim() : '';
    if (offerId.length > 0) {
      return offerId;
    }
    return sku;
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('EBAY', this.rpm(), async () => {
        for (const u of updates) {
          const sku = u.barcode.trim();
          const body: EbayInventoryItemPayload = {
            availability: {
              shipToLocationAvailability: {
                quantity: Math.max(0, Math.round(u.quantity)),
              },
            },
            condition: 'NEW',
            product: {
              title: sku,
              ean: sku.length > 0 ? [sku] : [],
            },
          };
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${EBAY_INVENTORY_BASE}/inventory_item/${encodeURIComponent(sku)}`,
              timeout: 25_000,
              data: body,
              ...this.auth(token),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('EBAY', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const currency = credentials.currency?.trim().toUpperCase() || EBAY_DEFAULT_CURRENCY;
      await withRateLimit('EBAY', this.rpm(), async () => {
        for (const u of updates) {
          const sku = u.barcode.trim();
          const offerId = await this.resolveOfferId(token, sku);
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${EBAY_INVENTORY_BASE}/offer/${encodeURIComponent(offerId)}`,
              timeout: 25_000,
              data: {
                pricingSummary: {
                  price: { value: String(u.salePrice), currency },
                },
              },
              ...this.auth(token),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('EBAY', 'updatePrice', error);
    }
  }

  /** Kargo bildirimi — POST order/{orderId}/shippingFulfillment */
  async submitShippingFulfillment(
    credentials: Record<string, string>,
    payload: EbayShippingFulfillmentPayload,
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const shippedDate =
        payload.shippedDate ?? new Date().toISOString();
      const carrier = payload.shippingCarrierCode?.trim() || 'OTHER';
      await withRateLimit('EBAY', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${EBAY_FULFILLMENT_BASE}/order/${encodeURIComponent(payload.orderId)}/shippingFulfillment`,
            timeout: 25_000,
            data: {
              lineItems: payload.lineItems,
              shippedDate,
              shippingCarrierCode: carrier,
              trackingNumber: payload.trackingNumber,
            },
            ...this.auth(token),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('EBAY', 'submitShippingFulfillment', error);
    }
  }
}
