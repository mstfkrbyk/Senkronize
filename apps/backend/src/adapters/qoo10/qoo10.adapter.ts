import { Injectable, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
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
  MarketplaceTokenCache,
  marketplaceTokenCacheKey,
} from '../common/marketplace-token-cache';
import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';
import { isRecord, parseMoney, throwSyncFailed } from '../stub-helpers';
import {
  fetchQoo10AccessToken,
  QOO10_GOODS_BASE,
  QOO10_SELLER_BASE,
  resolveQoo10Credentials,
  type Qoo10ResolvedCredentials,
} from './qoo10.auth';
import type {
  Qoo10ApiEnvelope,
  Qoo10GoodsRow,
  Qoo10OrderRow,
} from './qoo10.types';

@Injectable()
export class Qoo10Adapter implements IMarketplaceAdapter {
  readonly platform = 'QOO10';
  private readonly logger = new Logger(Qoo10Adapter.name);

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly tokenCache: MarketplaceTokenCache,
  ) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.QOO10 ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private tokenKey(creds: Qoo10ResolvedCredentials): string {
    return marketplaceTokenCacheKey(
      this.platform,
      `${creds.applicationKey}:${creds.userKey}`,
    );
  }

  private formatDate(d: Date): string {
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  private ensureArray<T>(v: T | T[] | undefined): T[] {
    if (v === undefined) {
      return [];
    }
    return Array.isArray(v) ? v : [v];
  }

  private unwrapResult(data: unknown): unknown {
    if (!isRecord(data)) {
      return data;
    }
    const env = data as Qoo10ApiEnvelope;
    const code = env.ResultCode;
    if (code !== undefined && code !== 0 && code !== '0' && code !== '00') {
      const msg =
        typeof env.ResultMsg === 'string' ? env.ResultMsg : 'Qoo10 API hatası';
      throw new Error(msg);
    }
    return env.ResultObject ?? data;
  }

  private async getAccessToken(
    credentials: Record<string, string>,
    forceRefresh = false,
  ): Promise<string> {
    const creds = resolveQoo10Credentials(credentials);
    const cacheKey = this.tokenKey(creds);
    if (!forceRefresh) {
      const cached = await this.tokenCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    } else {
      await this.tokenCache.invalidate(cacheKey);
    }
    const token = await fetchQoo10AccessToken(creds);
    await this.tokenCache.set(cacheKey, token);
    return token;
  }

  private async request<T>(
    credentials: Record<string, string>,
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    options: {
      params?: Record<string, string>;
      body?: Record<string, unknown>;
    } = {},
  ): Promise<T> {
    const execute = async (forceRefresh: boolean): Promise<T> => {
      const qAuthKey = await this.getAccessToken(credentials, forceRefresh);
      let result: unknown;
      await withRateLimit(this.platform, this.rpm(), async () => {
        result = await axiosWithRetry<unknown>(
          {
            method,
            url,
            timeout: 25_000,
            params: options.params,
            data: options.body,
            headers: {
              'Content-Type': 'application/json',
              QAuthKey: qAuthKey,
            },
          },
          { retryOn: [429, 500, 502, 503, 504] },
        );
      });
      return this.unwrapResult(result) as T;
    };

    try {
      return await execute(false);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        return await execute(true);
      }
      throw error;
    }
  }

  private splitBarcode(barcode: string): { itemCode: string; optionCode: string } {
    const sep = barcode.includes('|') ? '|' : barcode.includes(':') ? ':' : null;
    if (sep) {
      const [itemCode, optionCode] = barcode.split(sep, 2);
      return {
        itemCode: itemCode.trim(),
        optionCode: (optionCode ?? '').trim(),
      };
    }
    return { itemCode: barcode.trim(), optionCode: '' };
  }

  private normalizeOrderRows(raw: unknown): Qoo10OrderRow[] {
    if (Array.isArray(raw)) {
      return raw as Qoo10OrderRow[];
    }
    if (!isRecord(raw)) {
      return [];
    }
    for (const key of ['GoodsOrders', 'OrderList', 'Orders', 'items']) {
      const val = raw[key];
      if (Array.isArray(val)) {
        return val as Qoo10OrderRow[];
      }
    }
    return [];
  }

  private mapOrder(row: Qoo10OrderRow): MarketplaceOrder | null {
    const idRaw = row.OrderNo ?? row.OrderId ?? row.PackNo;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const name =
      typeof row.BuyerName === 'string' && row.BuyerName.length > 0
        ? row.BuyerName
        : typeof row.BuyerNm === 'string' && row.BuyerNm.length > 0
          ? row.BuyerNm
          : typeof row.Buyer === 'string' && row.Buyer.length > 0
            ? row.Buyer
            : '—';
    const itemCode =
      typeof row.ItemCode === 'string' ? row.ItemCode : String(row.ItemCode ?? '');
    const qtyRaw = row.OrderQty ?? row.ItemQty;
    const quantity =
      typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
        ? Math.max(0, Math.round(qtyRaw))
        : typeof qtyRaw === 'string'
          ? Math.max(0, Math.round(parseFloat(qtyRaw) || 0))
          : 1;
    const createdRaw = row.OrderDate;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    return {
      platformOrderId: String(idRaw),
      status:
        typeof row.OrderStatus === 'string' ? row.OrderStatus : 'NEW',
      customerName: name,
      items: [
        {
          sku: itemCode,
          barcode: itemCode,
          quantity,
          unitPrice: parseMoney(row.OrderPrice ?? row.SellerPrice ?? row.Total),
          platformItemId: itemCode,
          productName:
            typeof row.ItemTitle === 'string'
              ? row.ItemTitle
              : typeof row.ItemNm === 'string'
                ? row.ItemNm
                : undefined,
        },
      ],
      totalAmount: parseMoney(row.Total ?? row.OrderPrice ?? row.SellerPrice),
      currency: typeof row.Currency === 'string' ? row.Currency : 'USD',
      createdAt,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 1);
      await this.request<unknown>(
        credentials,
        'GET',
        `${QOO10_SELLER_BASE}/seller/GoodsOrders`,
        {
          params: {
            OrderStatus: 'NEW',
            StartDate: this.formatDate(start),
            EndDate: this.formatDate(end),
          },
        },
      );
      return true;
    } catch (error) {
      this.logger.warn('Qoo10 bağlantı testi başarısız', {
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
      const end = new Date();
      const start = since ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const raw = await this.request<unknown>(
        credentials,
        'GET',
        `${QOO10_SELLER_BASE}/seller/GoodsOrders`,
        {
          params: {
            OrderStatus: 'NEW',
            StartDate: this.formatDate(start),
            EndDate: this.formatDate(end),
          },
        },
      );
      return this.normalizeOrderRows(raw)
        .map((r) => this.mapOrder(r))
        .filter((x): x is MarketplaceOrder => x !== null);
    } catch (error) {
      throwSyncFailed('QOO10', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const raw = await this.request<unknown>(
        credentials,
        'GET',
        `${QOO10_GOODS_BASE}/goods/GetGoodsInfo`,
        {
          params: {
            Page: String(page + 1),
            RowsPerPage: '50',
          },
        },
      );
      const rows = this.ensureArray(
        isRecord(raw)
          ? (raw.Items as Qoo10GoodsRow[] | Qoo10GoodsRow | undefined)
          : Array.isArray(raw)
            ? (raw as Qoo10GoodsRow[])
            : undefined,
      );
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const itemCode =
          typeof row.ItemCode === 'string'
            ? row.ItemCode
            : String(row.ItemCode ?? `row-${i}`);
        const option =
          typeof row.OptionCode === 'string' ? row.OptionCode : '';
        const barcode =
          option.length > 0 ? `${itemCode}|${option}` : itemCode;
        const qtyRaw = row.StockQty ?? row.ItemQty;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : typeof qtyRaw === 'string'
              ? Math.max(0, Math.round(parseFloat(qtyRaw) || 0))
              : 0;
        const sale = parseMoney(row.SellerPrice ?? row.ItemPrice);
        const title =
          typeof row.ItemTitle === 'string'
            ? row.ItemTitle
            : typeof row.SellerCode === 'string'
              ? row.SellerCode
              : itemCode;
        return {
          platformProductId: itemCode,
          barcode,
          title,
          quantity,
          salePrice: sale,
          listPrice: sale,
          approved: true,
          images: [],
        };
      });
      return {
        items,
        total: items.length,
        page,
        pageSize: 50,
      };
    } catch (error) {
      throwSyncFailed('QOO10', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      for (const u of updates) {
        const { itemCode } = this.splitBarcode(u.barcode);
        await this.request<unknown>(
          credentials,
          'POST',
          `${QOO10_GOODS_BASE}/goods/UpdateGoodsInventory`,
          {
            body: {
              ItemCode: itemCode,
              ItemQty: u.quantity,
            },
          },
        );
      }
    } catch (error) {
      throwSyncFailed('QOO10', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      for (const u of updates) {
        const { itemCode } = this.splitBarcode(u.barcode);
        await this.request<unknown>(
          credentials,
          'POST',
          `${QOO10_GOODS_BASE}/goods/UpdateGoodsPrice`,
          {
            body: {
              ItemCode: itemCode,
              SellerPrice: u.salePrice,
            },
          },
        );
      }
    } catch (error) {
      throwSyncFailed('QOO10', 'updatePrice', error);
    }
  }

  async shipOrder(
    credentials: Record<string, string>,
    payload: {
      orderId: string;
      trackingNo: string;
      shippingCompany: string;
    },
  ): Promise<void> {
    try {
      await this.request<unknown>(
        credentials,
        'POST',
        `${QOO10_SELLER_BASE}/seller/UpdateOrderShipping`,
        {
          body: {
            orderId: payload.orderId,
            trackingNo: payload.trackingNo,
            shippingCompany: payload.shippingCompany,
          },
        },
      );
    } catch (error) {
      throwSyncFailed('QOO10', 'shipOrder', error);
    }
  }
}
