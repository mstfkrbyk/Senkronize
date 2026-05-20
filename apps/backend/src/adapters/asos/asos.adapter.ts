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
import {
  isRecord,
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import type { AsosOrder, AsosOrderLine, AsosProduct } from './asos.types';

const ASOS_API_BASE = 'https://api.asos.com/marketplace/v1';

@Injectable()
export class AsosAdapter implements IMarketplaceAdapter {
  readonly platform = 'ASOS';
  private readonly logger = new Logger(AsosAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.ASOS ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private headers(credentials: Record<string, string>): Record<string, string> {
    const apiKey = credentials.apiKey?.trim();
    const sellerId = credentials.sellerId?.trim();
    if (!apiKey || !sellerId) {
      throw new Error('ASOS: apiKey ve sellerId zorunludur');
    }
    return {
      'Asos-Api-Key': apiKey,
      'Asos-Seller-Id': sellerId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private mapOrder(row: AsosOrder): MarketplaceOrder | null {
    const idRaw = row.orderId ?? row.id;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const createdRaw = row.orderDate ?? row.createdAt;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    const lines = row.lines ?? row.items ?? [];
    return {
      platformOrderId: String(idRaw),
      status: typeof row.status === 'string' ? row.status : 'RECEIVED',
      customerName:
        typeof row.customerName === 'string' ? row.customerName : '—',
      items: lines.map((l: AsosOrderLine, i) => {
        const sku =
          typeof l.productCode === 'string'
            ? l.productCode
            : typeof l.sku === 'string'
              ? l.sku
              : `line-${String(i)}`;
        return {
          sku,
          barcode: sku,
          quantity:
            typeof l.quantity === 'number' && Number.isFinite(l.quantity)
              ? Math.max(0, Math.round(l.quantity))
              : 1,
          unitPrice: parseMoney(l.unitPrice),
          platformItemId: sku,
          productName:
            typeof l.productName === 'string' ? l.productName : undefined,
        };
      }),
      totalAmount: parseMoney(row.total),
      currency: typeof row.currency === 'string' ? row.currency : 'GBP',
      createdAt,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await withRateLimit('ASOS', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${ASOS_API_BASE}/orders`,
            timeout: 12_000,
            headers: this.headers(credentials),
            params: { status: 'RECEIVED', pageNumber: 1, pageSize: 1 },
          },
          { maxRetries: 1 },
        );
      });
      return true;
    } catch (error) {
      this.logger.warn('ASOS bağlantı testi başarısız', {
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
      const orders: MarketplaceOrder[] = [];
      let pageNumber = 1;
      const pageSize = 50;
      const sinceMs = since?.getTime();
      for (;;) {
        const data = await withRateLimit('ASOS', this.rpm(), async () =>
          axiosWithRetry<unknown>(
            {
              method: 'GET',
              url: `${ASOS_API_BASE}/orders`,
              timeout: 25_000,
              headers: this.headers(credentials),
              params: { status: 'RECEIVED', pageNumber, pageSize },
            },
            {},
          ),
        );
        const rows = normalizeOrdersRows(data) as AsosOrder[];
        if (rows.length === 0) {
          break;
        }
        for (const row of rows) {
          const mapped = this.mapOrder(row);
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
        if (rows.length < pageSize) {
          break;
        }
        pageNumber += 1;
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
      const pageSize = 50;
      const pageNumber = page + 1;
      const data = await withRateLimit('ASOS', this.rpm(), async () =>
        axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${ASOS_API_BASE}/products`,
            timeout: 25_000,
            headers: this.headers(credentials),
            params: { pageNumber, pageSize },
          },
          {},
        ),
      );
      const { rows, total } = normalizeProductRows(data);
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? (row as AsosProduct) : {};
        const code =
          typeof p.productCode === 'string'
            ? p.productCode
            : typeof p.sku === 'string'
              ? p.sku
              : `row-${i}`;
        const title = typeof p.title === 'string' ? p.title : code;
        const sale = parseMoney(p.salePrice ?? p.price);
        const list = parseMoney(p.listPrice ?? sale);
        const qtyRaw = p.quantity ?? p.stock ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        return {
          platformProductId: code,
          barcode: code,
          title,
          quantity,
          salePrice: sale,
          listPrice: list,
          approved: true,
          images: [],
        };
      });
      return {
        items,
        total: typeof total === 'number' ? total : items.length,
        page,
        pageSize,
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
      await withRateLimit('ASOS', this.rpm(), async () => {
        for (const u of updates) {
          await axiosWithRetry<unknown>(
            {
              method: 'PATCH',
              url: `${ASOS_API_BASE}/products/${encodeURIComponent(u.barcode)}`,
              timeout: 25_000,
              headers: this.headers(credentials),
              data: { quantity: u.quantity },
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
      await withRateLimit('ASOS', this.rpm(), async () => {
        for (const u of updates) {
          await axiosWithRetry<unknown>(
            {
              method: 'PATCH',
              url: `${ASOS_API_BASE}/products/${encodeURIComponent(u.barcode)}`,
              timeout: 25_000,
              headers: this.headers(credentials),
              data: {
                salePrice: u.salePrice,
                listPrice: u.listPrice,
              },
            },
            {},
          );
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', error);
    }
  }

}
