import { createHmac } from 'node:crypto';

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
import { KAUFLAND_API_BASE } from './kaufland.constants';
import type {
  KauflandInventoryResponse,
  KauflandOrderUnitsResponse,
} from './kaufland.types';

@Injectable()
export class KauflandAdapter implements IMarketplaceAdapter {
  readonly platform = 'KAUFLAND';
  private readonly logger = new Logger(KauflandAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.KAUFLAND ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private sign(secret: string, method: string, uriWithQuery: string, body: string, ts: string): string {
    const payload = [method.toUpperCase(), uriWithQuery, body, ts].join('\n');
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private signedConfig(
    credentials: Record<string, string>,
    method: string,
    pathWithQuery: string,
    body = '',
  ): AxiosRequestConfig {
    const accessKey = credentials.accessKey?.trim() ?? credentials.clientId?.trim();
    const secretKey = credentials.secretKey?.trim() ?? credentials.clientSecret?.trim();
    if (!accessKey || !secretKey) {
      throw new Error('Kaufland: accessKey ve secretKey zorunludur');
    }
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = this.sign(secretKey, method, pathWithQuery, body, ts);
    return {
      method,
      url: `${KAUFLAND_API_BASE}${pathWithQuery}`,
      data: body.length > 0 ? body : undefined,
      headers: {
        'Shop-Client-Key': accessKey,
        'Shop-Timestamp': ts,
        'Shop-Signature': signature,
        Accept: 'application/json',
        ...(body.length > 0 ? { 'Content-Type': 'application/json' } : {}),
        'User-Agent': 'Senkronize/1.0',
      },
      timeout: 25_000,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const path = '/v2/order-units?limit=1';
      await axiosWithRetry<unknown>(
        this.signedConfig(credentials, 'GET', path),
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Kaufland bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    _since?: Date,
  ): Promise<MarketplaceOrder[]> {
    void _since;
    try {
      const path = '/v2/order-units?limit=50';
      return await withRateLimit('KAUFLAND', this.rpm(), async () => {
        const data = await axiosWithRetry<KauflandOrderUnitsResponse>(
          this.signedConfig(credentials, 'GET', path),
          {},
        );
        const rows = Array.isArray(data.data) ? data.data : [];
        return rows.map((u) => {
          const oid =
            typeof u.id_order === 'number'
              ? String(u.id_order)
              : typeof u.id_order_unit === 'number'
                ? String(u.id_order_unit)
                : 'unknown';
          const created =
            typeof u.ts_created_iso === 'string' && u.ts_created_iso.length > 0
              ? new Date(u.ts_created_iso).toISOString()
              : new Date().toISOString();
          const price = parseMoney(u.price);
          const title = typeof u.title === 'string' ? u.title : '';
          return {
            platformOrderId: oid,
            status: typeof u.status === 'string' ? u.status : 'NEW',
            customerName: '—',
            items: [
              {
                sku: oid,
                barcode: oid,
                quantity: 1,
                unitPrice: price,
                platformItemId: String(u.id_order_unit ?? oid),
                productName: title.length > 0 ? title : undefined,
              },
            ],
            totalAmount: price,
            currency: typeof u.currency === 'string' ? u.currency : 'EUR',
            createdAt: created,
          };
        });
      });
    } catch (error) {
      throwSyncFailed('KAUFLAND', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const limit = 50;
      const offset = page * limit;
      const path = `/v2/items?limit=${String(limit)}&offset=${String(offset)}`;
      const data = await withRateLimit('KAUFLAND', this.rpm(), async () => {
        return await axiosWithRetry<KauflandInventoryResponse>(
          this.signedConfig(credentials, 'GET', path),
          {},
        );
      });
      const rows = Array.isArray(data.data) ? data.data : [];
      const items: MarketplaceListing[] = rows.map((r, i) => {
        const id = typeof r.id_item === 'number' ? String(r.id_item) : `item-${String(i)}`;
        const ean = typeof r.ean === 'string' ? r.ean : id;
        const title = typeof r.title === 'string' ? r.title : ean;
        const qty =
          typeof r.amount === 'number' && Number.isFinite(r.amount)
            ? Math.max(0, Math.round(r.amount))
            : 0;
        const price = parseMoney(r.price);
        return {
          platformProductId: id,
          barcode: ean,
          title,
          quantity: qty,
          salePrice: price,
          listPrice: price,
          approved: true,
          images: [],
        };
      });
      return { items, total: items.length, page, pageSize: limit };
    } catch (error) {
      throwSyncFailed('KAUFLAND', 'getListings', error);
    }
  }

  /**
   * `barcode` alanında Kaufland `id_item` (sayısal) beklenir.
   * Gerçek uç nokta Hitmeister/Kaufland sürümüne göre güncellenebilir.
   */
  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      await withRateLimit('KAUFLAND', this.rpm(), async () => {
        for (const u of updates) {
          const idItem = encodeURIComponent(u.barcode);
          const body = JSON.stringify({ quantity: u.quantity });
          const path = `/v2/items/${idItem}/quantity`;
          await axiosWithRetry<unknown>(
            this.signedConfig(credentials, 'PATCH', path, body),
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('KAUFLAND', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      await withRateLimit('KAUFLAND', this.rpm(), async () => {
        for (const u of updates) {
          const idItem = encodeURIComponent(u.barcode);
          const body = JSON.stringify({ price: u.salePrice });
          const path = `/v2/items/${idItem}/price`;
          await axiosWithRetry<unknown>(
            this.signedConfig(credentials, 'PATCH', path, body),
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('KAUFLAND', 'updatePrice', error);
    }
  }
}
