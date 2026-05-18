import { Injectable, Logger } from '@nestjs/common';
import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { EncryptionService } from '../../common/encryption/encryption.service';
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
import type {
  EbayFulfillmentLineItem,
  EbayFulfillmentOrder,
  EbayOAuthTokenResponse,
  EbayOrdersResponse,
} from './ebay.types';

const EBAY_IDENTITY = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_FULFILLMENT_BASE = 'https://api.ebay.com/sell/fulfillment/v1';
const EBAY_INVENTORY_BASE = 'https://api.ebay.com/sell/inventory/v1';

@Injectable()
export class EbayAdapter implements IMarketplaceAdapter {
  readonly platform = 'EBAY';
  private readonly logger = new Logger(EbayAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.EBAY ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const cached = credentials.accessToken?.trim();
    if (cached) {
      return cached;
    }
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    const refreshToken = credentials.refreshToken?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'eBay: clientId, clientSecret ve refreshToken (veya accessToken) zorunludur',
      );
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
    const { data } = await axios.post<EbayOAuthTokenResponse>(EBAY_IDENTITY, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      timeout: 20_000,
    });
    const token = typeof data.access_token === 'string' ? data.access_token : '';
    if (!token) {
      throw new Error('eBay: access_token alınamadı');
    }
    return token;
  }

  private auth(token: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const token = await this.getAccessToken(credentials);
      const url = `${EBAY_FULFILLMENT_BASE}/order`;
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url,
          timeout: 12_000,
          params: { limit: 1 },
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
      currency: 'USD',
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
      const sinceIso =
        since !== undefined ? since.toISOString() : undefined;
      let out: MarketplaceOrder[] = [];
      await withRateLimit('EBAY', this.rpm(), async () => {
        const data = await axiosWithRetry<EbayOrdersResponse>(
          {
            method: 'GET',
            url,
            timeout: 25_000,
            params: {
              limit: 50,
              ...(sinceIso !== undefined ? { filter: `creationdate:[${sinceIso}]` } : {}),
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
        const avail = isRecord(p.availability)
          ? p.availability
          : undefined;
        const qtyRaw = isRecord(avail?.shipToLocationAvailability)
          ? avail.shipToLocationAvailability.quantity
          : p.quantity;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        return {
          platformProductId: id,
          barcode: sku,
          title: typeof p.title === 'string' ? p.title : sku,
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

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const url = `${EBAY_INVENTORY_BASE}/bulk_update_price_quantity`;
      await withRateLimit('EBAY', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url,
            timeout: 25_000,
            data: {
              requests: updates.map((u) => ({
                sku: u.barcode,
                shipToLocationAvailability: [{ quantity: u.quantity }],
              })),
            },
            ...this.auth(token),
          },
          {},
        );
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
      const url = `${EBAY_INVENTORY_BASE}/bulk_update_price_quantity`;
      await withRateLimit('EBAY', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url,
            timeout: 25_000,
            data: {
              requests: updates.map((u) => ({
                sku: u.barcode,
                offers: [
                  {
                    pricingSummary: {
                      price: { value: String(u.salePrice), currency: 'USD' },
                    },
                  },
                ],
              })),
            },
            ...this.auth(token),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('EBAY', 'updatePrice', error);
    }
  }
}
