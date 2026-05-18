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
import {
  isRecord,
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import type { GetirOrder, GetirOrderLine, GetirTokenResponse } from './getir.types';

const GETIR_BASE = 'https://merchant.getir.com/api';
/** Placeholder — gerçek endpoint dokümantasyona göre güncellenmeli */
const PATH_TOKEN = '/v1/oauth/token';
const PATH_ORDERS = '/v1/orders';
const PATH_PRODUCTS = '/v1/products';
const PATH_STOCK = '/v1/inventory/stock';
const PATH_PRICE = '/v1/inventory/price';

@Injectable()
export class GetirAdapter implements IMarketplaceAdapter {
  readonly platform = 'GETIR';
  private readonly logger = new Logger(GetirAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.GETIR ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const direct = credentials.accessToken?.trim();
    if (direct) {
      return direct;
    }
    const merchantId = credentials.merchantId?.trim();
    const secret = credentials.secret?.trim();
    if (!merchantId || !secret) {
      throw new Error('Getir: merchantId ve secret (veya accessToken) zorunludur');
    }
    const url = `${GETIR_BASE}${PATH_TOKEN}`;
    const body = { merchant_id: merchantId, secret };
    const data = await axiosWithRetry<GetirTokenResponse>(
      {
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        timeout: 15_000,
        data: body,
      },
      {},
    );
    const token = typeof data.access_token === 'string' ? data.access_token : '';
    if (!token) {
      throw new Error('Getir: access_token alınamadı');
    }
    return token;
  }

  private authConfig(token: string): Pick<AxiosRequestConfig, 'headers'> {
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
      const url = `${GETIR_BASE}/v1/merchant/profile`;
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url,
          timeout: 12_000,
          ...this.authConfig(token),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Getir bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const o = row as GetirOrder;
    const idRaw = o.id ?? o.order_id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const lines = o.lines ?? o.items ?? [];
    const createdRaw = o.created_at;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const name =
      typeof o.customer_name === 'string' && o.customer_name.length > 0
        ? o.customer_name
        : '—';
    return {
      platformOrderId: String(idRaw),
      status: typeof o.status === 'string' ? o.status : 'NEW',
      customerName: name,
      items: lines.map((l: GetirOrderLine) => ({
        sku: typeof l.sku === 'string' ? l.sku : String(l.barcode ?? ''),
        barcode: typeof l.barcode === 'string' ? l.barcode : String(l.sku ?? ''),
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.unit_price),
        platformItemId:
          l.id !== undefined && l.id !== null ? String(l.id) : String(l.sku ?? ''),
        productName:
          typeof l.product_name === 'string' ? l.product_name : undefined,
      })),
      totalAmount: parseMoney(o.total_amount),
      currency: typeof o.currency === 'string' ? o.currency : 'TRY',
      createdAt,
      cargoTrackingNumber:
        typeof o.tracking_number === 'string' ? o.tracking_number : undefined,
      cargoProvider:
        typeof o.courier_name === 'string' ? o.courier_name : undefined,
    };
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const token = await this.getAccessToken(credentials);
      const url = `${GETIR_BASE}${PATH_ORDERS}`;
      const sinceMs = since ? since.getTime() : undefined;
      let rows: MarketplaceOrder[] = [];
      await withRateLimit('GETIR', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params:
              sinceMs !== undefined
                ? { updated_since: new Date(sinceMs).toISOString() }
                : undefined,
            ...this.authConfig(token),
          },
          {},
        );
        rows = normalizeOrdersRows(data)
          .map((r) => this.mapOrder(r))
          .filter((x): x is MarketplaceOrder => x !== null);
      });
      return rows;
    } catch (error) {
      throwSyncFailed('GETIR', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const token = await this.getAccessToken(credentials);
      const url = `${GETIR_BASE}${PATH_PRODUCTS}`;
      const { rows, total } = await withRateLimit('GETIR', this.rpm(), async () => {
        const data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 20_000,
            params: { page, page_size: 50 },
            ...this.authConfig(token),
          },
          {},
        );
        return normalizeProductRows(data);
      });
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const idRaw = p.id ?? p.sku;
        const id =
          idRaw !== undefined && idRaw !== null ? String(idRaw) : `row-${i}`;
        const barcode =
          typeof p.barcode === 'string'
            ? p.barcode
            : typeof p.sku === 'string'
              ? p.sku
              : id;
        const titleRaw = p.title ?? p.name ?? barcode;
        const title =
          typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
        const sale = parseMoney(p.sale_price ?? p.price);
        const qtyRaw = p.stock ?? p.quantity ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        const images: string[] = [];
        if (Array.isArray(p.images)) {
          for (const im of p.images) {
            if (typeof im === 'string') {
              images.push(im);
            } else if (isRecord(im) && typeof im.url === 'string') {
              images.push(im.url);
            }
          }
        }
        return {
          platformProductId: id,
          barcode,
          title,
          quantity,
          salePrice: sale,
          listPrice: parseMoney(p.list_price ?? sale),
          approved: p.active !== false,
          images,
        };
      });
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize: 50,
      };
    } catch (error) {
      throwSyncFailed('GETIR', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const url = `${GETIR_BASE}${PATH_STOCK}`;
      await withRateLimit('GETIR', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url,
            timeout: 20_000,
            data: { items: updates.map((u) => ({ sku: u.barcode, qty: u.quantity })) },
            ...this.authConfig(token),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('GETIR', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const token = await this.getAccessToken(credentials);
      const url = `${GETIR_BASE}${PATH_PRICE}`;
      await withRateLimit('GETIR', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'PATCH',
            url,
            timeout: 20_000,
            data: {
              items: updates.map((u) => ({
                sku: u.barcode,
                sale_price: u.salePrice,
                list_price: u.listPrice,
              })),
            },
            ...this.authConfig(token),
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('GETIR', 'updatePrice', error);
    }
  }
}
