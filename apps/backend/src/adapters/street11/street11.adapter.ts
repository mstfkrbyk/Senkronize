import { Injectable, Logger } from '@nestjs/common';
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
import { isRecord, parseMoney, throwSyncFailed } from '../stub-helpers';

const STREET11_BASE = 'https://api.11st.co.kr/rest';
const ROWS_PER_PAGE = 50;

interface Street11OrderRow {
  ordNo?: string | number;
  ordPrdSeq?: string | number;
  prdNo?: string | number;
  prdNm?: string;
  ordAmt?: number | string;
  ordQty?: number | string;
  ordDt?: string;
  ordNm?: string;
  rcvrNm?: string;
  ordStatCd?: string;
  selPrc?: number | string;
}

@Injectable()
export class Street11Adapter implements IMarketplaceAdapter {
  readonly platform = 'STREET11';
  private readonly logger = new Logger(Street11Adapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.STREET11 ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private requireApiKey(credentials: Record<string, string>): string {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      throw new Error('11Street KR: apiKey zorunludur');
    }
    return apiKey;
  }

  private requireSellerId(credentials: Record<string, string>): string {
    const sellerId =
      credentials.sellerId?.trim() ??
      credentials.supplierId?.trim() ??
      credentials.vendorId?.trim() ??
      '';
    if (!sellerId) {
      throw new Error('11Street KR: sellerId (veya supplierId/vendorId) zorunludur');
    }
    return sellerId;
  }

  private headers(apiKey: string): { headers: Record<string, string> } {
    return {
      headers: {
        'Content-Type': 'application/json',
        openapikey: apiKey,
      },
    };
  }

  private formatOrderDate(d: Date): string {
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

  private normalizeOrderRows(data: unknown): Street11OrderRow[] {
    if (Array.isArray(data)) {
      return data as Street11OrderRow[];
    }
    if (!isRecord(data)) {
      return [];
    }
    if (Array.isArray(data.orders)) {
      return data.orders as Street11OrderRow[];
    }
    if (Array.isArray(data.orderList)) {
      return data.orderList as Street11OrderRow[];
    }
    if (isRecord(data.result) && Array.isArray(data.result.orders)) {
      return data.result.orders as Street11OrderRow[];
    }
    return [];
  }

  private mapOrder(row: Street11OrderRow): MarketplaceOrder | null {
    const idRaw = row.ordNo;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const name =
      typeof row.ordNm === 'string' && row.ordNm.length > 0
        ? row.ordNm
        : typeof row.rcvrNm === 'string' && row.rcvrNm.length > 0
          ? row.rcvrNm
          : '—';
    const prdNo =
      row.prdNo !== undefined && row.prdNo !== null ? String(row.prdNo) : '';
    const qtyRaw = row.ordQty;
    const quantity =
      typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
        ? Math.max(0, Math.round(qtyRaw))
        : typeof qtyRaw === 'string'
          ? Math.max(0, Math.round(parseFloat(qtyRaw) || 0))
          : 1;
    const createdRaw = row.ordDt;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    return {
      platformOrderId: String(idRaw),
      status: typeof row.ordStatCd === 'string' ? row.ordStatCd : 'NEW',
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
          productName: typeof row.prdNm === 'string' ? row.prdNm : undefined,
        },
      ],
      totalAmount: parseMoney(row.ordAmt ?? row.selPrc),
      currency: 'KRW',
      createdAt,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiKey = this.requireApiKey(credentials);
      const sellerId = this.requireSellerId(credentials);
      const url = `${STREET11_BASE}/orderdtl`;
      await withRateLimit('STREET11', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url,
            timeout: 12_000,
            params: {
              sellerId,
              orderDt: this.formatOrderDate(new Date()),
              pageNum: '1',
              rowsPerPage: String(ROWS_PER_PAGE),
            },
            ...this.headers(apiKey),
          },
          { maxRetries: 1 },
        );
      });
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
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const apiKey = this.requireApiKey(credentials);
      const sellerId = this.requireSellerId(credentials);
      const end = new Date();
      const start = since ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dates: string[] = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        dates.push(this.formatOrderDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      const byOrderId = new Map<string, MarketplaceOrder>();
      for (const orderDt of dates) {
        let pageNum = 1;
        let hasMore = true;
        while (hasMore) {
          let data: unknown;
          await withRateLimit('STREET11', this.rpm(), async () => {
            data = await axiosWithRetry<unknown>(
              {
                method: 'GET',
                url: `${STREET11_BASE}/orderdtl`,
                timeout: 20_000,
                params: {
                  sellerId,
                  orderDt,
                  pageNum: String(pageNum),
                  rowsPerPage: String(ROWS_PER_PAGE),
                },
                ...this.headers(apiKey),
              },
              {},
            );
          });
          const rows = this.normalizeOrderRows(data);
          for (const row of rows) {
            const mapped = this.mapOrder(row);
            if (mapped) {
              byOrderId.set(mapped.platformOrderId, mapped);
            }
          }
          hasMore = rows.length >= ROWS_PER_PAGE;
          pageNum += 1;
        }
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
      const apiKey = this.requireApiKey(credentials);
      for (const u of updates) {
        const prdNo = u.barcode.trim();
        await withRateLimit('STREET11', this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${STREET11_BASE}/products/stock`,
              timeout: 20_000,
              params: { prdNo },
              data: {
                prdNo,
                ordStatCd: '01',
                stckCnt: u.quantity,
              },
              ...this.headers(apiKey),
            },
            {},
          );
        });
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
      const apiKey = this.requireApiKey(credentials);
      for (const u of updates) {
        const prdNo = u.barcode.trim();
        await withRateLimit('STREET11', this.rpm(), async () => {
          await axiosWithRetry<unknown>(
            {
              method: 'PUT',
              url: `${STREET11_BASE}/products/price`,
              timeout: 20_000,
              params: { prdNo },
              data: {
                prdNo,
                selPrc: u.salePrice,
              },
              ...this.headers(apiKey),
            },
            {},
          );
        });
      }
    } catch (error) {
      throwSyncFailed('STREET11', 'updatePrice', error);
    }
  }
}
