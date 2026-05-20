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

const STREET11_BASE = 'https://api.11st.co.kr/rest';
const ROWS_PER_PAGE = 50;

interface Street11OrderRow {
  ordNo?: string | number;
  orderNo?: string | number;
  ordPrdSeq?: string | number;
  prdNo?: string | number;
  productCode?: string | number;
  prdNm?: string;
  productName?: string;
  ordAmt?: number | string;
  ordQty?: number | string;
  ordDt?: string;
  orderDate?: string;
  ordNm?: string;
  buyerName?: string;
  rcvrNm?: string;
  ordStatCd?: string;
  selPrc?: number | string;
}

@Injectable()
export class Street11Adapter implements IMarketplaceAdapter {
  readonly platform = 'STREET11';
  private readonly logger = new Logger(Street11Adapter.name);

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly tokenCache: MarketplaceTokenCache,
  ) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.STREET11 ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private requireApiKey(credentials: Record<string, string>): string {
    const apiKey = credentials.apiKey?.trim() ?? credentials.openapikey?.trim();
    if (!apiKey) {
      throw new Error('11Street KR: apiKey (openapikey) zorunludur');
    }
    return apiKey;
  }

  private tokenKey(apiKey: string): string {
    return marketplaceTokenCacheKey(this.platform, apiKey);
  }

  private async getAccessToken(
    credentials: Record<string, string>,
    forceRefresh = false,
  ): Promise<string> {
    const apiKey = this.requireApiKey(credentials);
    const cacheKey = this.tokenKey(apiKey);
    if (!forceRefresh) {
      const cached = await this.tokenCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    } else {
      await this.tokenCache.invalidate(cacheKey);
    }
    await this.tokenCache.set(cacheKey, apiKey);
    return apiKey;
  }

  private async request<T>(
    credentials: Record<string, string>,
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    options: {
      params?: Record<string, string>;
      body?: Record<string, unknown>;
    } = {},
  ): Promise<T> {
    const execute = async (forceRefresh: boolean): Promise<T> => {
      const token = await this.getAccessToken(credentials, forceRefresh);
      let data: unknown;
      await withRateLimit(this.platform, this.rpm(), async () => {
        data = await axiosWithRetry<unknown>(
          {
            method,
            url: `${STREET11_BASE}${path}`,
            timeout: 20_000,
            params: options.params,
            data: options.body,
            headers: {
              'Content-Type': 'application/json',
              openapikey: token,
            },
          },
          { retryOn: [429, 500, 502, 503, 504] },
        );
      });
      return data as T;
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

  private ensureArray<T>(v: T | T[] | undefined): T[] {
    if (v === undefined) {
      return [];
    }
    return Array.isArray(v) ? v : [v];
  }

  private normalizeOrderRows(data: unknown): Street11OrderRow[] {
    if (Array.isArray(data)) {
      return data as Street11OrderRow[];
    }
    if (!isRecord(data)) {
      return [];
    }
    for (const key of [
      'purchaseOrders',
      'orders',
      'orderList',
      'items',
      'data',
    ]) {
      const val = data[key];
      if (Array.isArray(val)) {
        return val as Street11OrderRow[];
      }
    }
    if (isRecord(data.result)) {
      for (const key of ['purchaseOrders', 'orders', 'orderList']) {
        const val = data.result[key];
        if (Array.isArray(val)) {
          return val as Street11OrderRow[];
        }
      }
    }
    return [];
  }

  private mapOrder(row: Street11OrderRow): MarketplaceOrder | null {
    const idRaw = row.ordNo ?? row.orderNo;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const name =
      typeof row.ordNm === 'string' && row.ordNm.length > 0
        ? row.ordNm
        : typeof row.buyerName === 'string' && row.buyerName.length > 0
          ? row.buyerName
          : typeof row.rcvrNm === 'string' && row.rcvrNm.length > 0
            ? row.rcvrNm
            : '—';
    const prdNo =
      row.prdNo !== undefined && row.prdNo !== null
        ? String(row.prdNo)
        : row.productCode !== undefined && row.productCode !== null
          ? String(row.productCode)
          : '';
    const qtyRaw = row.ordQty;
    const quantity =
      typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
        ? Math.max(0, Math.round(qtyRaw))
        : typeof qtyRaw === 'string'
          ? Math.max(0, Math.round(parseFloat(qtyRaw) || 0))
          : 1;
    const createdRaw = row.ordDt ?? row.orderDate;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    return {
      platformOrderId: String(idRaw),
      status: typeof row.ordStatCd === 'string' ? row.ordStatCd : 'Order',
      customerName: name,
      items: [
        {
          sku: prdNo,
          barcode: prdNo,
          quantity,
          unitPrice: parseMoney(row.ordAmt ?? row.selPrc),
          platformItemId:
            row.ordPrdSeq !== undefined && row.ordPrdSeq !== null
              ? String(row.ordPrdSeq)
              : prdNo,
          productName:
            typeof row.prdNm === 'string'
              ? row.prdNm
              : typeof row.productName === 'string'
                ? row.productName
                : undefined,
        },
      ],
      totalAmount: parseMoney(row.ordAmt ?? row.selPrc),
      currency: 'KRW',
      createdAt,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.request<unknown>(
        credentials,
        'GET',
        '/prodmallservice/purchaseorders',
        {
          params: {
            pageNo: '1',
            rowsPerPage: '1',
            selOrdStatusCd: 'Order',
          },
        },
      );
      return true;
    } catch (error) {
      this.logger.warn('11Street KR bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    _since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const byOrderId = new Map<string, MarketplaceOrder>();
      let pageNo = 1;
      let hasMore = true;
      while (hasMore) {
        const data = await this.request<unknown>(
          credentials,
          'GET',
          '/prodmallservice/purchaseorders',
          {
            params: {
              pageNo: String(pageNo),
              rowsPerPage: String(ROWS_PER_PAGE),
              selOrdStatusCd: 'Order',
            },
          },
        );
        const rows = this.normalizeOrderRows(data);
        for (const row of rows) {
          const mapped = this.mapOrder(row);
          if (mapped) {
            byOrderId.set(mapped.platformOrderId, mapped);
          }
        }
        hasMore = rows.length >= ROWS_PER_PAGE;
        pageNo += 1;
      }
      return [...byOrderId.values()];
    } catch (error) {
      throwSyncFailed('STREET11', 'getOrders', error);
    }
  }

  async getListings(
    _credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    return {
      items: [],
      total: 0,
      page,
      pageSize: ROWS_PER_PAGE,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      for (const u of updates) {
        const productCode = u.barcode.trim();
        await this.request<unknown>(
          credentials,
          'PUT',
          `/prodmallservice/products/${encodeURIComponent(productCode)}/inventory`,
          {
            body: {
              productCode,
              stockQty: u.quantity,
            },
          },
        );
      }
    } catch (error) {
      throwSyncFailed('STREET11', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      for (const u of updates) {
        const productCode = u.barcode.trim();
        await this.request<unknown>(
          credentials,
          'PUT',
          `/prodmallservice/products/${encodeURIComponent(productCode)}/saleprice`,
          {
            body: {
              productCode,
              salePrice: u.salePrice,
            },
          },
        );
      }
    } catch (error) {
      throwSyncFailed('STREET11', 'updatePrice', error);
    }
  }

  async shipOrder(
    credentials: Record<string, string>,
    payload: {
      orderId: string;
      deliveryCompanyCode: string;
      invoiceNumber: string;
    },
  ): Promise<void> {
    try {
      await this.request<unknown>(
        credentials,
        'POST',
        `/prodmallservice/purchaseorders/${encodeURIComponent(payload.orderId)}/shipments`,
        {
          body: {
            deliveryCompanyCode: payload.deliveryCompanyCode,
            invoiceNumber: payload.invoiceNumber,
          },
        },
      );
    } catch (error) {
      throwSyncFailed('STREET11', 'shipOrder', error);
    }
  }
}
