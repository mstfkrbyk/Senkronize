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
import { ALLEGRO_ACCEPT, ALLEGRO_API_BASE } from './allegro.constants';
import { refreshAllegroAccessToken } from './allegro.oauth';
import type {
  AllegroCheckoutForm,
  AllegroCheckoutFormsResponse,
  AllegroFulfillmentPayload,
  AllegroOffersListingResponse,
} from './allegro.types';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const CHECKOUT_PAGE_SIZE = 20;

@Injectable()
export class AllegroAdapter implements IMarketplaceAdapter {
  readonly platform = 'ALLEGRO';
  private readonly logger = new Logger(AllegroAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.ALLEGRO ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private authHeaders(token: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: ALLEGRO_ACCEPT,
        'Content-Type': ALLEGRO_ACCEPT,
      },
    };
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
        'Allegro: clientId, clientSecret ve refreshToken (veya geçerli accessToken) zorunludur',
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
    const tokens = await refreshAllegroAccessToken(
      clientId,
      clientSecret,
      refreshToken,
    );
    credentials.accessToken = tokens.accessToken;
    credentials.refreshToken = tokens.refreshToken;
    credentials.tokenExpiresAt = String(tokens.tokenExpiresAt);
    return tokens.accessToken;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const token = await this.getAccessToken(credentials);
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${ALLEGRO_API_BASE}/me`,
          timeout: 12_000,
          ...this.authHeaders(token),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Allegro bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapOrder(f: AllegroCheckoutForm): MarketplaceOrder | null {
    const id = f.id;
    if (typeof id !== 'string' || id.length === 0) {
      return null;
    }
    const buyer = f.buyer;
    const login = typeof buyer?.login === 'string' ? buyer.login : '';
    const email = typeof buyer?.email === 'string' ? buyer.email : '';
    const customerName = login.length > 0 ? login : email.length > 0 ? email : '—';
    const lines = Array.isArray(f.lineItems) ? f.lineItems : [];
    const totalStr = f.summary?.totalToPay?.amount;
    const currency = f.summary?.totalToPay?.currency ?? 'PLN';
    const updated = f.updatedAt;
    return {
      platformOrderId: id,
      status: typeof f.status === 'string' ? f.status : 'UNKNOWN',
      customerName,
      items: lines.map((l) => ({
        sku: typeof l.offer?.id === 'string' ? l.offer.id : String(l.id ?? ''),
        barcode: typeof l.offer?.id === 'string' ? l.offer.id : String(l.id ?? ''),
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.price?.amount),
        platformItemId: typeof l.id === 'string' ? l.id : String(l.offer?.id ?? ''),
        productName: typeof l.offer?.name === 'string' ? l.offer.name : undefined,
      })),
      totalAmount: parseMoney(totalStr),
      currency,
      createdAt:
        typeof updated === 'string' && updated.length > 0
          ? new Date(updated).toISOString()
          : new Date().toISOString(),
    };
  }

  async getCheckoutForm(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<AllegroCheckoutForm | null> {
    try {
      const token = await this.getAccessToken(credentials);
      return await withRateLimit('ALLEGRO', this.rpm(), async () => {
        return await axiosWithRetry<AllegroCheckoutForm>(
          {
            method: 'GET',
            url: `${ALLEGRO_API_BASE}/order/checkout-forms/${encodeURIComponent(orderId)}`,
            timeout: 20_000,
            ...this.authHeaders(token),
          },
          { maxRetries: 1 },
        );
      });
    } catch (error) {
      this.logger.warn('Allegro sipariş detayı alınamadı', {
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
      let offset = 0;

      await withRateLimit('ALLEGRO', this.rpm(), async () => {
        for (;;) {
          const data = await axiosWithRetry<AllegroCheckoutFormsResponse>(
            {
              method: 'GET',
              url: `${ALLEGRO_API_BASE}/order/checkout-forms`,
              timeout: 25_000,
              params: {
                limit: CHECKOUT_PAGE_SIZE,
                offset,
                status: 'READY_FOR_PROCESSING',
                ...(since !== undefined
                  ? { 'updatedAt.gte': since.toISOString() }
                  : {}),
              },
              ...this.authHeaders(token),
            },
            {},
          );
          const forms = Array.isArray(data.checkoutForms) ? data.checkoutForms : [];
          for (const form of forms) {
            const mapped = this.mapOrder(form);
            if (mapped) {
              all.push(mapped);
            }
          }
          if (forms.length < CHECKOUT_PAGE_SIZE) {
            break;
          }
          offset += CHECKOUT_PAGE_SIZE;
        }
      });
      return all;
    } catch (error) {
      throwSyncFailed('ALLEGRO', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const token = await this.getAccessToken(credentials);
      const limit = 100;
      const offset = page * limit;
      const data = await withRateLimit('ALLEGRO', this.rpm(), async () => {
        return await axiosWithRetry<AllegroOffersListingResponse>(
          {
            method: 'GET',
            url: `${ALLEGRO_API_BASE}/sale/offers`,
            timeout: 25_000,
            params: { limit, offset },
            ...this.authHeaders(token),
          },
          {},
        );
      });
      const offers = Array.isArray(data.offers) ? data.offers : [];
      const items: MarketplaceListing[] = offers.map((o, i) => {
        const offerId = typeof o.id === 'string' ? o.id : `offer-${String(i)}`;
        const name = typeof o.name === 'string' ? o.name : offerId;
        const qty =
          typeof o.stock?.available === 'number' && Number.isFinite(o.stock.available)
            ? Math.max(0, Math.round(o.stock.available))
            : 0;
        const price = parseMoney(o.sellingMode?.price?.amount);
        const pub = o.publication?.status;
        const approved =
          typeof pub === 'string' &&
          ['ACTIVE', 'ACTIVATING'].includes(pub.toUpperCase());
        return {
          platformProductId: offerId,
          barcode: offerId,
          title: name,
          quantity: qty,
          salePrice: price,
          listPrice: price,
          approved,
          images: [],
        };
      });
      const totalRaw = data.totalCount ?? data.count;
      const total =
        typeof totalRaw === 'number' && Number.isFinite(totalRaw)
          ? totalRaw
          : items.length;
      return { items, total, page, pageSize: limit };
    } catch (error) {
      throwSyncFailed('ALLEGRO', 'getListings', error);
    }
  }

  private offerPatchUrl(offerId: string): string {
    return `${ALLEGRO_API_BASE}/sale/product-offers/${encodeURIComponent(offerId)}`;
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('ALLEGRO', this.rpm(), async () => {
        for (const u of updates) {
          await axiosWithRetry<unknown>(
            {
              method: 'PATCH',
              url: this.offerPatchUrl(u.barcode),
              timeout: 20_000,
              data: { stock: { available: u.quantity, unit: 'UNIT' } },
              ...this.authHeaders(token),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('ALLEGRO', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const currency = credentials.currency?.trim().toUpperCase() || 'PLN';
      await withRateLimit('ALLEGRO', this.rpm(), async () => {
        for (const u of updates) {
          await axiosWithRetry<unknown>(
            {
              method: 'PATCH',
              url: this.offerPatchUrl(u.barcode),
              timeout: 20_000,
              data: {
                sellingMode: {
                  price: {
                    amount: String(u.salePrice),
                    currency,
                  },
                },
              },
              ...this.authHeaders(token),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('ALLEGRO', 'updatePrice', error);
    }
  }

  /** Kargo / gönderim bildirimi — PUT checkout-forms/{orderId}/fulfillment */
  async submitFulfillment(
    credentials: Record<string, string>,
    payload: AllegroFulfillmentPayload,
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('ALLEGRO', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PUT',
            url: `${ALLEGRO_API_BASE}/order/checkout-forms/${encodeURIComponent(payload.orderId)}/fulfillment`,
            timeout: 25_000,
            data: {
              status: 'SENT',
              shipmentSummary: { lineItemsSent: 'ALL' },
            },
            ...this.authHeaders(token),
          },
          { maxRetries: 2 },
        );
      });
    } catch (error) {
      throwSyncFailed('ALLEGRO', 'submitFulfillment', error);
    }
  }
}
