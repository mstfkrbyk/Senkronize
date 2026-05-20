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
  MERCADOLIBRE_API_BASE,
  MERCADOLIBRE_DEFAULT_CURRENCY,
  MERCADOLIBRE_ORDERS_PAGE_SIZE,
} from './mercadolibre.constants';
import {
  buildMercadolibreAuthorizeUrl,
  refreshMercadolibreAccessToken,
} from './mercadolibre.oauth';
import type {
  MercadolibreFulfillmentPayload,
  MercadolibreItemSearchHit,
  MercadolibreItemsSearchResponse,
  MercadolibreOrder,
  MercadolibreOrderItem,
  MercadolibreOrdersSearchResponse,
  MercadolibreQuestion,
  MercadolibreQuestionsSearchResponse,
  MercadolibreShipment,
} from './mercadolibre.types';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

@Injectable()
export class MercadolibreAdapter implements IMarketplaceAdapter {
  readonly platform = 'MERCADOLIBRE';
  private readonly logger = new Logger(MercadolibreAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.MERCADOLIBRE ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  getAuthorizationUrl(
    credentials: Record<string, string>,
    state: string,
    redirectUri: string,
  ): string {
    const clientId = credentials.clientId?.trim() ?? '';
    if (!clientId) {
      throw new Error('MercadoLibre: clientId zorunludur');
    }
    return buildMercadolibreAuthorizeUrl(clientId, redirectUri, state);
  }

  private authHeaders(token: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  private resolveSellerId(credentials: Record<string, string>): string {
    const sellerId =
      credentials.sellerId?.trim() ||
      credentials.userId?.trim() ||
      credentials.merchantId?.trim() ||
      '';
    if (!sellerId) {
      throw new Error('MercadoLibre: sellerId zorunludur');
    }
    return sellerId;
  }

  private resolveOAuthCredentials(credentials: Record<string, string>): {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  } {
    const clientId = credentials.clientId?.trim() ?? '';
    const clientSecret = credentials.clientSecret?.trim() ?? '';
    const refreshToken = credentials.refreshToken?.trim() ?? '';
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'MercadoLibre: clientId, clientSecret ve refreshToken (veya geçerli accessToken) zorunludur',
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
      this.resolveOAuthCredentials(credentials);
    const tokens = await refreshMercadolibreAccessToken(
      clientId,
      clientSecret,
      refreshToken,
    );
    credentials.accessToken = tokens.accessToken;
    credentials.refreshToken = tokens.refreshToken;
    credentials.tokenExpiresAt = String(tokens.tokenExpiresAt);
    if (tokens.userId && !credentials.sellerId?.trim() && !credentials.userId?.trim()) {
      credentials.sellerId = tokens.userId;
      credentials.userId = tokens.userId;
    }
    return tokens.accessToken;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const token = await this.getAccessToken(credentials);
      const sellerId = this.resolveSellerId(credentials);
      await axiosWithRetry<MercadolibreOrdersSearchResponse>(
        {
          method: 'GET',
          url: `${MERCADOLIBRE_API_BASE}/orders/search`,
          timeout: 12_000,
          params: {
            seller: sellerId,
            sort: 'date_desc',
            'order.status': 'paid',
            limit: 1,
          },
          ...this.authHeaders(token),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('MercadoLibre bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapOrder(o: MercadolibreOrder): MarketplaceOrder | null {
    const idRaw = o.id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const id = String(idRaw);
    if (id.length === 0) {
      return null;
    }
    const buyer = o.buyer;
    const nick = typeof buyer?.nickname === 'string' ? buyer.nickname : '';
    const fullName = [buyer?.first_name, buyer?.last_name]
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .join(' ');
    const customerName = nick.length > 0 ? nick : fullName.length > 0 ? fullName : '—';
    const lines = Array.isArray(o.order_items) ? o.order_items : [];
    const currency =
      typeof o.currency_id === 'string' ? o.currency_id : MERCADOLIBRE_DEFAULT_CURRENCY;
    return {
      platformOrderId: id,
      status: typeof o.status === 'string' ? o.status : 'paid',
      customerName,
      items: lines.map((l) => {
        const itemId = typeof l.item?.id === 'string' ? l.item.id : '';
        const qty =
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0;
        return {
          sku: itemId,
          barcode: itemId,
          quantity: qty,
          unitPrice: parseMoney(l.unit_price ?? l.full_unit_price),
          platformItemId: itemId,
          productName: typeof l.item?.title === 'string' ? l.item.title : undefined,
        };
      }),
      totalAmount: parseMoney(o.total_amount),
      currency,
      createdAt:
        typeof o.date_created === 'string' && o.date_created.length > 0
          ? new Date(o.date_created).toISOString()
          : new Date().toISOString(),
    };
  }

  async getOrderDetail(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<MercadolibreOrder | null> {
    try {
      const token = await this.getAccessToken(credentials);
      const order = await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        return await axiosWithRetry<MercadolibreOrder>(
          {
            method: 'GET',
            url: `${MERCADOLIBRE_API_BASE}/orders/${encodeURIComponent(orderId)}`,
            timeout: 20_000,
            ...this.authHeaders(token),
          },
          { maxRetries: 1 },
        );
      });
      const items = await this.getOrderItems(credentials, orderId);
      if (items.length > 0) {
        order.order_items = items;
      }
      return order;
    } catch (error) {
      this.logger.warn('MercadoLibre sipariş detayı alınamadı', {
        orderId,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return null;
    }
  }

  async getOrderItems(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<MercadolibreOrderItem[]> {
    try {
      const token = await this.getAccessToken(credentials);
      return await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        const data = await axiosWithRetry<{ order_items?: MercadolibreOrderItem[] }>(
          {
            method: 'GET',
            url: `${MERCADOLIBRE_API_BASE}/orders/${encodeURIComponent(orderId)}/order_items`,
            timeout: 20_000,
            ...this.authHeaders(token),
          },
          { maxRetries: 1 },
        );
        return Array.isArray(data.order_items) ? data.order_items : [];
      });
    } catch (error) {
      this.logger.warn('MercadoLibre sipariş kalemleri alınamadı', {
        orderId,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async getShipment(
    credentials: Record<string, string>,
    shipmentId: string,
  ): Promise<MercadolibreShipment | null> {
    try {
      const token = await this.getAccessToken(credentials);
      return await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        return await axiosWithRetry<MercadolibreShipment>(
          {
            method: 'GET',
            url: `${MERCADOLIBRE_API_BASE}/shipments/${encodeURIComponent(shipmentId)}`,
            timeout: 20_000,
            ...this.authHeaders(token),
          },
          { maxRetries: 1 },
        );
      });
    } catch (error) {
      this.logger.warn('MercadoLibre kargo bilgisi alınamadı', {
        shipmentId,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return null;
    }
  }

  async updateShipmentTracking(
    credentials: Record<string, string>,
    shipmentId: string,
    trackingNumber: string,
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url: `${MERCADOLIBRE_API_BASE}/shipments/${encodeURIComponent(shipmentId)}/tracking_number`,
            timeout: 25_000,
            data: { tracking_number: trackingNumber.trim() },
            ...this.authHeaders(token),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('MERCADOLIBRE', 'updateShipmentTracking', error);
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const token = await this.getAccessToken(credentials);
      const sellerId = this.resolveSellerId(credentials);
      const all: MarketplaceOrder[] = [];
      let offset = 0;

      await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        for (;;) {
          const data = await axiosWithRetry<MercadolibreOrdersSearchResponse>(
            {
              method: 'GET',
              url: `${MERCADOLIBRE_API_BASE}/orders/search`,
              timeout: 25_000,
              params: {
                seller: sellerId,
                sort: 'date_desc',
                'order.status': 'paid',
                limit: MERCADOLIBRE_ORDERS_PAGE_SIZE,
                offset,
              },
              ...this.authHeaders(token),
            },
            {},
          );
          const results = Array.isArray(data.results) ? data.results : [];
          for (const row of results) {
            if (since !== undefined) {
              const createdRaw = row.date_created;
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
          const total = data.paging?.total;
          offset += MERCADOLIBRE_ORDERS_PAGE_SIZE;
          if (
            results.length < MERCADOLIBRE_ORDERS_PAGE_SIZE ||
            (typeof total === 'number' && offset >= total)
          ) {
            break;
          }
        }
      });
      return all;
    } catch (error) {
      throwSyncFailed('MERCADOLIBRE', 'getOrders', error);
    }
  }

  private async fetchItem(
    token: string,
    itemId: string,
  ): Promise<MercadolibreItemSearchHit | null> {
    try {
      return await axiosWithRetry<MercadolibreItemSearchHit>(
        {
          method: 'GET',
          url: `${MERCADOLIBRE_API_BASE}/items/${encodeURIComponent(itemId)}`,
          timeout: 20_000,
          ...this.authHeaders(token),
        },
        { maxRetries: 1 },
      );
    } catch {
      return null;
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const token = await this.getAccessToken(credentials);
      const sellerId = this.resolveSellerId(credentials);
      const limit = 50;
      const offset = page * limit;
      const search = await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        return await axiosWithRetry<MercadolibreItemsSearchResponse>(
          {
            method: 'GET',
            url: `${MERCADOLIBRE_API_BASE}/users/${encodeURIComponent(sellerId)}/items/search`,
            timeout: 25_000,
            params: { limit, offset },
            ...this.authHeaders(token),
          },
          {},
        );
      });
      const ids = Array.isArray(search.results) ? search.results : [];
      const items: MarketplaceListing[] = [];
      for (const itemId of ids) {
        if (typeof itemId !== 'string' || itemId.length === 0) {
          continue;
        }
        const hit = await this.fetchItem(token, itemId);
        if (!hit) {
          continue;
        }
        const qty =
          typeof hit.available_quantity === 'number' &&
          Number.isFinite(hit.available_quantity)
            ? Math.max(0, Math.round(hit.available_quantity))
            : 0;
        const sale = parseMoney(hit.price);
        items.push({
          platformProductId: itemId,
          barcode: itemId,
          title: typeof hit.title === 'string' ? hit.title : itemId,
          quantity: qty,
          salePrice: sale,
          listPrice: sale,
          approved: hit.status === 'active',
          images:
            typeof hit.thumbnail === 'string' && hit.thumbnail.length > 0
              ? [hit.thumbnail]
              : [],
        });
      }
      const total = search.paging?.total;
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize: limit,
      };
    } catch (error) {
      throwSyncFailed('MERCADOLIBRE', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        for (const u of updates) {
          const itemId = u.barcode.trim();
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${MERCADOLIBRE_API_BASE}/items/${encodeURIComponent(itemId)}`,
              timeout: 25_000,
              data: {
                available_quantity: Math.max(0, Math.round(u.quantity)),
              },
              ...this.authHeaders(token),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('MERCADOLIBRE', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const currency =
        credentials.currency?.trim().toUpperCase() || MERCADOLIBRE_DEFAULT_CURRENCY;
      await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        for (const u of updates) {
          const itemId = u.barcode.trim();
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${MERCADOLIBRE_API_BASE}/items/${encodeURIComponent(itemId)}`,
              timeout: 25_000,
              data: {
                price: u.salePrice,
                currency_id: currency,
              },
              ...this.authHeaders(token),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('MERCADOLIBRE', 'updatePrice', error);
    }
  }

  async getQuestions(
    credentials: Record<string, string>,
    listingId: string,
  ): Promise<MercadolibreQuestion[]> {
    try {
      const token = await this.getAccessToken(credentials);
      const data = await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        return await axiosWithRetry<MercadolibreQuestionsSearchResponse>(
          {
            method: 'GET',
            url: `${MERCADOLIBRE_API_BASE}/questions/search`,
            timeout: 20_000,
            params: {
              item_id: listingId.trim(),
              status: 'UNANSWERED',
            },
            ...this.authHeaders(token),
          },
          { maxRetries: 1 },
        );
      });
      return Array.isArray(data.questions) ? data.questions : [];
    } catch (error) {
      this.logger.warn('MercadoLibre sorular alınamadı', {
        listingId,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async answerQuestion(
    credentials: Record<string, string>,
    questionId: string,
    text: string,
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${MERCADOLIBRE_API_BASE}/answers`,
            timeout: 25_000,
            data: {
              question_id: questionId,
              text: text.trim(),
            },
            ...this.authHeaders(token),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('MERCADOLIBRE', 'answerQuestion', error);
    }
  }

  async submitShipmentFulfillment(
    credentials: Record<string, string>,
    payload: MercadolibreFulfillmentPayload,
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('MERCADOLIBRE', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${MERCADOLIBRE_API_BASE}/shipments/${encodeURIComponent(payload.shipmentId)}/fulfillment`,
            timeout: 25_000,
            data: { order_item_ids: payload.orderItemIds },
            ...this.authHeaders(token),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('MERCADOLIBRE', 'submitShipmentFulfillment', error);
    }
  }
}
