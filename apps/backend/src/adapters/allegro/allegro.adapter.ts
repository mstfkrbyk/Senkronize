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
import { ALLEGRO_ACCEPT, ALLEGRO_API_BASE, ALLEGRO_TOKEN_URL } from './allegro.constants';
import type {
  AllegroCheckoutForm,
  AllegroCheckoutFormsResponse,
  AllegroOffersListingResponse,
  AllegroTokenResponse,
} from './allegro.types';

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

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const cached = credentials.accessToken?.trim();
    if (cached) {
      return cached;
    }
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('Allegro: clientId ve clientSecret zorunludur');
    }
    const scope = credentials.scope?.trim();
    const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    if (scope) {
      body.set('scope', scope);
    }
    const data = await axiosWithRetry<AllegroTokenResponse>(
      {
        method: 'POST',
        url: ALLEGRO_TOKEN_URL,
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: body.toString(),
        timeout: 20_000,
      },
      {},
    );
    const token = typeof data.access_token === 'string' ? data.access_token : '';
    if (!token) {
      throw new Error('Allegro: access_token alınamadı');
    }
    return token;
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

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const token = await this.getAccessToken(credentials);
      return await withRateLimit('ALLEGRO', this.rpm(), async () => {
        const data = await axiosWithRetry<AllegroCheckoutFormsResponse>(
          {
            method: 'GET',
            url: `${ALLEGRO_API_BASE}/order/checkout-forms`,
            timeout: 25_000,
            params: {
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
        return forms
          .map((f) => this.mapOrder(f))
          .filter((x): x is MarketplaceOrder => x !== null);
      });
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
}
