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

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';
import { fetchClientCredentialsToken } from '../internal/oauth-client-credentials';
import {
  isRecord,
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import { JOOM_API_BASE, JOOM_TOKEN_URL } from './joom.constants';
import type { JoomOrder, JoomOrderLine, JoomProduct } from './joom.types';

function parseProductVariant(barcode: string): { productId: string; variantId: string } {
  const sep = barcode.includes(':') ? ':' : '|';
  const parts = barcode.split(sep).map((p) => p.trim());
  if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
    return { productId: parts[0], variantId: parts[1] };
  }
  throw new Error('Joom: barcode productId:variantId formatında olmalıdır');
}

@Injectable()
export class JoomAdapter implements IMarketplaceAdapter {
  readonly platform = 'JOOM';
  private readonly logger = new Logger(JoomAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.JOOM ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const direct = credentials.accessToken?.trim();
    if (direct) {
      return direct;
    }
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('Joom: clientId ve clientSecret (veya accessToken) zorunludur');
    }
    const tokenUrl = credentials.oauthTokenUrl?.trim() ?? JOOM_TOKEN_URL;
    return fetchClientCredentialsToken(tokenUrl, clientId, clientSecret);
  }

  private authConfig(token: string): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  private mapOrder(row: JoomOrder, lines: JoomOrderLine[] = []): MarketplaceOrder | null {
    const idRaw = row.id ?? row.orderId;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const createdRaw = row.createdAt ?? row.created_at;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const customer =
      typeof row.customerName === 'string'
        ? row.customerName
        : typeof row.customer?.name === 'string'
          ? row.customer.name
          : '—';
    const orderLines = lines.length > 0 ? lines : (row.items ?? row.products ?? []);
    return {
      platformOrderId: String(idRaw),
      status: typeof row.status === 'string' ? row.status : 'APPROVED',
      customerName: customer,
      items: orderLines.map((l, i) => {
        const sku =
          typeof l.sku === 'string'
            ? l.sku
            : l.productId && l.variantId
              ? `${l.productId}:${l.variantId}`
              : `line-${String(i)}`;
        return {
          sku,
          barcode: sku,
          quantity:
            typeof l.quantity === 'number' && Number.isFinite(l.quantity)
              ? Math.max(0, Math.round(l.quantity))
              : 1,
          unitPrice: parseMoney(l.price),
          platformItemId:
            l.id !== undefined && l.id !== null
              ? String(l.id)
              : l.variantId !== undefined
                ? String(l.variantId)
                : sku,
          productName: typeof l.name === 'string' ? l.name : undefined,
        };
      }),
      totalAmount: parseMoney(row.total ?? row.totalAmount),
      currency: typeof row.currency === 'string' ? row.currency : 'RUB',
      createdAt,
      cargoTrackingNumber:
        typeof row.trackingNumber === 'string' ? row.trackingNumber : undefined,
      cargoProvider:
        typeof row.carrierCode === 'string' ? row.carrierCode : undefined,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('JOOM', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${JOOM_API_BASE}/orders`,
            timeout: 12_000,
            params: { limit: 1, offset: 0, status: 'APPROVED' },
            ...this.authConfig(token),
          },
          { maxRetries: 1 },
        );
      });
      return true;
    } catch (error) {
      this.logger.warn('Joom bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const token = await this.getAccessToken(credentials);
      const orders: MarketplaceOrder[] = [];
      const sinceMs = since?.getTime();
      let offset = 0;
      const limit = 50;
      for (;;) {
        const data = await withRateLimit('JOOM', this.rpm(), async () =>
          axiosWithRetry<unknown>(
            {
              method: 'GET',
              url: `${JOOM_API_BASE}/orders`,
              timeout: 25_000,
              params: { limit, offset, status: 'APPROVED' },
              ...this.authConfig(token),
            },
            {},
          ),
        );
        const rows = normalizeOrdersRows(data) as JoomOrder[];
        if (rows.length === 0) {
          break;
        }
        for (const row of rows) {
          const orderId = row.id ?? row.orderId;
          if (orderId === undefined || orderId === null) {
            continue;
          }
          const detail = await withRateLimit('JOOM', this.rpm(), async () =>
            axiosWithRetry<unknown>(
              {
                method: 'GET',
                url: `${JOOM_API_BASE}/orders/${encodeURIComponent(String(orderId))}`,
                timeout: 25_000,
                ...this.authConfig(token),
              },
              {},
            ),
          );
          const detailRow = isRecord(detail)
            ? ((detail.data as JoomOrder | undefined) ??
              (detail.order as JoomOrder | undefined) ??
              (detail as JoomOrder))
            : row;
          const lines = Array.isArray(detailRow.items)
            ? detailRow.items
            : Array.isArray(detailRow.products)
              ? detailRow.products
              : [];
          const mapped = this.mapOrder(detailRow, lines);
          if (!mapped) {
            continue;
          }
          if (sinceMs !== undefined) {
            const created = new Date(mapped.createdAt).getTime();
            if (created < sinceMs) {
              continue;
            }
          }
          orders.push(mapped);
        }
        if (rows.length < limit) {
          break;
        }
        offset += limit;
      }
      return orders;
    } catch (error) {
      throwSyncFailed(this.platform, 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const token = await this.getAccessToken(credentials);
      const limit = 50;
      const data = await withRateLimit('JOOM', this.rpm(), async () =>
        axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${JOOM_API_BASE}/products`,
            timeout: 25_000,
            params: { limit, offset: page * limit },
            ...this.authConfig(token),
          },
          {},
        ),
      );
      const { rows, total } = normalizeProductRows(data);
      const items: MarketplaceListing[] = [];
      for (const row of rows) {
        if (!isRecord(row)) {
          continue;
        }
        const p = row as JoomProduct;
        const productId =
          p.id !== undefined && p.id !== null ? String(p.id) : undefined;
        const variants = Array.isArray(p.variants) ? p.variants : [];
        if (variants.length === 0 && productId) {
          items.push({
            platformProductId: productId,
            barcode: productId,
            title: typeof p.name === 'string' ? p.name : productId,
            quantity: 0,
            salePrice: 0,
            listPrice: 0,
            approved: true,
            images: [],
          });
          continue;
        }
        for (const v of variants) {
          const variantId =
            v.id !== undefined && v.id !== null ? String(v.id) : undefined;
          if (!productId || !variantId) {
            continue;
          }
          const barcode = `${productId}:${variantId}`;
          const qty = v.inventory?.quantity ?? 0;
          const priceVal = v.price?.value ?? 0;
          const sale =
            typeof priceVal === 'number' && priceVal > 100
              ? priceVal / 100
              : parseMoney(priceVal);
          items.push({
            platformProductId: barcode,
            barcode,
            title: typeof p.name === 'string' ? p.name : barcode,
            quantity:
              typeof qty === 'number' && Number.isFinite(qty)
                ? Math.max(0, Math.round(qty))
                : 0,
            salePrice: sale,
            listPrice: sale,
            approved: true,
            images: [],
          });
        }
      }
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize: limit,
      };
    } catch (error) {
      throwSyncFailed(this.platform, 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('JOOM', this.rpm(), async () => {
        for (const u of updates) {
          const { productId, variantId } = parseProductVariant(u.barcode);
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${JOOM_API_BASE}/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
              timeout: 25_000,
              data: { inventory: { quantity: u.quantity } },
              ...this.authConfig(token),
            },
            {},
          );
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const currency = credentials.currency?.trim() ?? 'RUB';
      await withRateLimit('JOOM', this.rpm(), async () => {
        for (const u of updates) {
          const { productId, variantId } = parseProductVariant(u.barcode);
          const amount = u.salePrice > 0 ? u.salePrice : u.listPrice;
          const value = Math.round(amount * 100);
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${JOOM_API_BASE}/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
              timeout: 25_000,
              data: { price: { value, currency } },
              ...this.authConfig(token),
            },
            {},
          );
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }

  /** Kargo bildirimi — POST /orders/{orderId}/tracking */
  async shipOrder(
    credentials: Record<string, string>,
    orderId: string,
    trackingNumber: string,
    carrierCode: string,
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      await withRateLimit('JOOM', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${JOOM_API_BASE}/orders/${encodeURIComponent(orderId)}/tracking`,
            timeout: 25_000,
            data: { trackingNumber, carrierCode },
            ...this.authConfig(token),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'shipOrder', error);
    }
  }
}
