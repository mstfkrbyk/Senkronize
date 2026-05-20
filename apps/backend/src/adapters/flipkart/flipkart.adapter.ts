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
import { parseMoney, throwSyncFailed } from '../stub-helpers';
import {
  FLIPKART_API_BASE,
  FLIPKART_DEFAULT_CURRENCY,
  FLIPKART_ORDER_STATE,
  FLIPKART_PAGE_SIZE,
} from './flipkart.constants';
import { fetchFlipkartClientCredentialsToken } from './flipkart.oauth';
import type {
  FlipkartDispatchPayload,
  FlipkartListingRow,
  FlipkartListingsV3Response,
  FlipkartOrderItem,
  FlipkartOrderSummary,
  FlipkartOrdersFilterResponse,
  FlipkartShipmentPayload,
} from './flipkart.types';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

@Injectable()
export class FlipkartAdapter implements IMarketplaceAdapter {
  readonly platform = 'FLIPKART';
  private readonly logger = new Logger(FlipkartAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.FLIPKART ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private resolveClientCredentials(credentials: Record<string, string>): {
    clientId: string;
    clientSecret: string;
  } {
    const clientId =
      credentials.clientId?.trim() ||
      credentials.apiKey?.trim() ||
      '';
    const clientSecret =
      credentials.clientSecret?.trim() ||
      credentials.secretKey?.trim() ||
      credentials.apiSecret?.trim() ||
      '';
    if (!clientId || !clientSecret) {
      throw new Error('Flipkart: clientId ve clientSecret zorunludur');
    }
    return { clientId, clientSecret };
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const direct = credentials.accessToken?.trim();
    const expiresRaw = credentials.tokenExpiresAt?.trim();
    if (direct && expiresRaw) {
      const expiresAt = Number.parseInt(expiresRaw, 10);
      if (Number.isFinite(expiresAt) && Date.now() < expiresAt - TOKEN_REFRESH_BUFFER_MS) {
        return direct;
      }
    } else if (direct && !credentials.clientSecret?.trim() && !credentials.secretKey?.trim()) {
      return direct;
    }

    const { clientId, clientSecret } = this.resolveClientCredentials(credentials);
    const tokens = await fetchFlipkartClientCredentialsToken(clientId, clientSecret);
    credentials.accessToken = tokens.accessToken;
    credentials.tokenExpiresAt = String(tokens.tokenExpiresAt);
    return tokens.accessToken;
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
      await withRateLimit('FLIPKART', this.rpm(), async () => {
        await axiosWithRetry<FlipkartOrdersFilterResponse>(
          {
            method: 'GET',
            url: `${FLIPKART_API_BASE}/orders/filter`,
            timeout: 12_000,
            params: {
              orderState: FLIPKART_ORDER_STATE,
              pageSize: 1,
            },
            ...this.auth(token),
          },
          { maxRetries: 1 },
        );
      });
      return true;
    } catch (error) {
      this.logger.warn('Flipkart bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private collectOrderItems(order: FlipkartOrderSummary): FlipkartOrderItem[] {
    const direct = Array.isArray(order.orderItems) ? order.orderItems : [];
    if (direct.length > 0) {
      return direct;
    }
    const fromSub: FlipkartOrderItem[] = [];
    const subs = Array.isArray(order.subOrders) ? order.subOrders : [];
    for (const sub of subs) {
      const items = Array.isArray(sub.orderItems) ? sub.orderItems : [];
      fromSub.push(...items);
    }
    return fromSub;
  }

  private mapOrder(row: FlipkartOrderSummary): MarketplaceOrder | null {
    const idRaw = row.orderId;
    if (typeof idRaw !== 'string' || idRaw.length === 0) {
      return null;
    }
    const lines = this.collectOrderItems(row);
    const createdRaw = row.orderDate;
    const customerName =
      typeof row.buyerName === 'string' && row.buyerName.length > 0
        ? row.buyerName
        : typeof row.customerName === 'string' && row.customerName.length > 0
          ? row.customerName
          : '—';
    const total =
      typeof row.totalAmount === 'number'
        ? row.totalAmount
        : typeof row.orderAmount === 'number'
          ? row.orderAmount
          : 0;
    return {
      platformOrderId: idRaw,
      status: typeof row.orderState === 'string' ? row.orderState : 'APPROVED',
      customerName,
      items: lines.map((l) => {
        const sku =
          typeof l.fsn === 'string'
            ? l.fsn
            : typeof l.sku === 'string'
              ? l.sku
              : typeof l.skuId === 'string'
                ? l.skuId
                : '';
        const qty =
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0;
        const unitPrice = parseMoney(l.sellingPrice ?? l.price);
        return {
          sku,
          barcode: sku,
          quantity: qty,
          unitPrice,
          platformItemId:
            typeof l.orderItemId === 'string' ? l.orderItemId : sku,
          productName: typeof l.title === 'string' ? l.title : undefined,
        };
      }),
      totalAmount: total,
      currency: FLIPKART_DEFAULT_CURRENCY,
      createdAt:
        typeof createdRaw === 'string' && createdRaw.length > 0
          ? new Date(createdRaw).toISOString()
          : new Date().toISOString(),
    };
  }

  async getOrderDetail(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<FlipkartOrderSummary | null> {
    try {
      const token = await this.getAccessToken(credentials);
      return await withRateLimit('FLIPKART', this.rpm(), async () => {
        return await axiosWithRetry<FlipkartOrderSummary>(
          {
            method: 'GET',
            url: `${FLIPKART_API_BASE}/orders/${encodeURIComponent(orderId)}`,
            timeout: 20_000,
            ...this.auth(token),
          },
          { maxRetries: 1 },
        );
      });
    } catch (error) {
      this.logger.warn('Flipkart sipariş detayı alınamadı', {
        orderId,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return null;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const token = await this.getAccessToken(credentials);
      const all: MarketplaceOrder[] = [];
      let pageNumber = 1;
      let nextAbsoluteUrl: string | undefined;
      const baseParams: Record<string, string | number> = {
        orderState: FLIPKART_ORDER_STATE,
        pageSize: FLIPKART_PAGE_SIZE,
      };
      if (since !== undefined) {
        baseParams.fromDate = since.toISOString();
        baseParams.toDate = new Date().toISOString();
      }

      await withRateLimit('FLIPKART', this.rpm(), async () => {
        for (;;) {
          const data = await axiosWithRetry<FlipkartOrdersFilterResponse>(
            {
              method: 'GET',
              url: nextAbsoluteUrl ?? `${FLIPKART_API_BASE}/orders/filter`,
              timeout: 25_000,
              ...(nextAbsoluteUrl
                ? {}
                : { params: { ...baseParams, pageNumber } }),
              ...this.auth(token),
            },
            {},
          );
          const rows = Array.isArray(data.orderItems)
            ? data.orderItems
            : Array.isArray(data.orderList)
              ? data.orderList
              : Array.isArray(data.orders)
                ? data.orders
                : [];
          for (const row of rows) {
            if (since !== undefined) {
              const createdRaw = row.orderDate;
              if (typeof createdRaw === 'string' && createdRaw.length > 0) {
                const created = new Date(createdRaw);
                if (Number.isFinite(created.getTime()) && created < since) {
                  continue;
                }
              }
            }
            const mapped = this.mapOrder(row);
            if (mapped) {
              all.push(mapped);
            }
          }
          const nextPageUrl =
            typeof data.nextPageUrl === 'string' && data.nextPageUrl.length > 0
              ? data.nextPageUrl
              : undefined;
          if (nextPageUrl) {
            nextAbsoluteUrl = nextPageUrl;
            continue;
          }
          if (
            data.hasMore === true &&
            rows.length >= FLIPKART_PAGE_SIZE &&
            typeof data.nextPageNumber === 'number'
          ) {
            nextAbsoluteUrl = undefined;
            pageNumber = data.nextPageNumber;
            continue;
          }
          break;
        }
      });
      return all;
    } catch (error) {
      throwSyncFailed('FLIPKART', 'getOrders', error);
    }
  }

  private listingSku(row: FlipkartListingRow): string {
    return (
      (typeof row.skuId === 'string' && row.skuId) ||
      (typeof row.fsn === 'string' && row.fsn) ||
      (typeof row.sku === 'string' && row.sku) ||
      ''
    );
  }

  private mapListing(row: FlipkartListingRow): MarketplaceListing | null {
    const sku = this.listingSku(row);
    if (sku.length === 0) {
      return null;
    }
    const qty =
      typeof row.available === 'number' && Number.isFinite(row.available)
        ? Math.max(0, Math.round(row.available))
        : typeof row.inventory?.available === 'number' &&
            Number.isFinite(row.inventory.available)
          ? Math.max(0, Math.round(row.inventory.available))
          : typeof row.inventory?.quantity === 'number' &&
              Number.isFinite(row.inventory.quantity)
            ? Math.max(0, Math.round(row.inventory.quantity))
            : 0;
    const sale = parseMoney(
      row.sellingPrice ?? row.price?.selling_price ?? row.price?.sellingPrice,
    );
    const list = parseMoney(row.mrp ?? row.price?.mrp ?? sale);
    const title =
      typeof row.productTitle === 'string'
        ? row.productTitle
        : typeof row.title === 'string'
          ? row.title
          : sku;
    const status = row.status ?? row.listingStatus;
    return {
      platformProductId: sku,
      barcode: sku,
      title,
      quantity: qty,
      salePrice: sale,
      listPrice: list,
      approved: status === 'ACTIVE' || status === undefined,
      images: [],
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const token = await this.getAccessToken(credentials);
      const pageNumber = page + 1;
      const data = await withRateLimit('FLIPKART', this.rpm(), async () => {
        return await axiosWithRetry<FlipkartListingsV3Response>(
          {
            method: 'GET',
            url: `${FLIPKART_API_BASE}/listings/v3`,
            timeout: 25_000,
            params: {
              status: 'ACTIVE',
              page: pageNumber,
              pageSize: FLIPKART_PAGE_SIZE,
            },
            ...this.auth(token),
          },
          {},
        );
      });
      const rows = Array.isArray(data.listings)
        ? data.listings
        : Array.isArray(data.available)
          ? data.available
          : [];
      const items: MarketplaceListing[] = [];
      for (const row of rows) {
        const mapped = this.mapListing(row);
        if (mapped) {
          items.push(mapped);
        }
      }
      const total =
        typeof data.totalCount === 'number' && Number.isFinite(data.totalCount)
          ? data.totalCount
          : items.length;
      return {
        items,
        total,
        page,
        pageSize: FLIPKART_PAGE_SIZE,
      };
    } catch (error) {
      throwSyncFailed('FLIPKART', 'getListings', error);
    }
  }

  private buildListingsV2Patch(
    updates: Array<{ skuId: string; available?: number; mrp?: number; sellingPrice?: number }>,
  ): Record<string, { available: number; mrp: number; sellingPrice: number }> {
    const body: Record<string, { available: number; mrp: number; sellingPrice: number }> = {};
    for (const u of updates) {
      body[u.skuId] = {
        available: Math.max(0, Math.round(u.available ?? 0)),
        mrp: u.mrp ?? 0,
        sellingPrice: u.sellingPrice ?? 0,
      };
    }
    return body;
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const patchUpdates = updates.map((u) => ({
        skuId: u.barcode.trim(),
        available: Math.max(0, Math.round(u.quantity)),
      }));
      await withRateLimit('FLIPKART', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url: `${FLIPKART_API_BASE}/listings/v2`,
            timeout: 25_000,
            data: this.buildListingsV2Patch(patchUpdates),
            ...this.auth(token),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('FLIPKART', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const patchUpdates = updates.map((u) => ({
        skuId: u.barcode.trim(),
        mrp: u.listPrice > 0 ? u.listPrice : u.salePrice,
        sellingPrice: u.salePrice,
      }));
      await withRateLimit('FLIPKART', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url: `${FLIPKART_API_BASE}/listings/v2`,
            timeout: 25_000,
            data: this.buildListingsV2Patch(patchUpdates),
            ...this.auth(token),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('FLIPKART', 'updatePrice', error);
    }
  }

  async dispatchOrder(
    credentials: Record<string, string>,
    payload: FlipkartDispatchPayload,
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('FLIPKART', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${FLIPKART_API_BASE}/orders/dispatch`,
            timeout: 25_000,
            data: payload,
            ...this.auth(token),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('FLIPKART', 'dispatchOrder', error);
    }
  }

  /** @deprecated dispatchOrder kullanın */
  async createShipment(
    credentials: Record<string, string>,
    payload: FlipkartShipmentPayload,
  ): Promise<void> {
    const detail = await this.getOrderDetail(credentials, payload.orderId);
    const lines = detail ? this.collectOrderItems(detail) : [];
    const shipments = lines
      .filter((l) => typeof l.orderItemId === 'string' && l.orderItemId.length > 0)
      .map((l) => ({
        orderItemId: l.orderItemId as string,
        fsn:
          (typeof l.fsn === 'string' && l.fsn) ||
          (typeof l.sku === 'string' && l.sku) ||
          (typeof l.skuId === 'string' && l.skuId) ||
          '',
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(1, Math.round(l.quantity))
            : 1,
        trackingId: payload.trackingId,
        serviceName: payload.serviceName?.trim() || 'FEDEX',
      }))
      .filter((s) => s.fsn.length > 0);
    if (shipments.length === 0) {
      throw new Error('Flipkart: kargo bildirimi için sipariş kalemi bulunamadı');
    }
    await this.dispatchOrder(credentials, { shipments });
  }
}
