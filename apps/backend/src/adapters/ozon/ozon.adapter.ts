import { Injectable, Logger } from '@nestjs/common';
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
import { OZON_API_BASE } from './ozon.constants';
import type {
  OzonPosting,
  OzonPostingGetResponse,
  OzonPostingsListResponse,
  OzonProductListResponse,
  OzonShipResponse,
} from './ozon.types';

@Injectable()
export class OzonAdapter implements IMarketplaceAdapter {
  readonly platform = 'OZON';
  private readonly logger = new Logger(OzonAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.OZON ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private headers(credentials: Record<string, string>): Record<string, string> {
    const clientId = credentials.clientId?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!clientId || !apiKey) {
      throw new Error('Ozon: Client-Id ve Api-Key zorunludur');
    }
    return {
      'Client-Id': clientId,
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    };
  }

  private resolveWarehouseId(credentials: Record<string, string>): number {
    const warehouseIdRaw = credentials.warehouseId?.trim();
    if (!warehouseIdRaw || Number.isNaN(parseInt(warehouseIdRaw, 10))) {
      return 0;
    }
    return parseInt(warehouseIdRaw, 10);
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await axiosWithRetry<unknown>(
        {
          method: 'POST',
          url: `${OZON_API_BASE}/v1/warehouse/list`,
          timeout: 12_000,
          data: {},
          headers: this.headers(credentials),
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Ozon bağlantı testi başarısız', {
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
      const sinceDate = since ?? new Date(Date.now() - 7 * 86400000);
      const toDate = new Date();
      const limit = 50;
      let offset = 0;
      let hasNext = true;
      const all: MarketplaceOrder[] = [];

      while (hasNext) {
        const page = await withRateLimit('OZON', this.rpm(), async () =>
          axiosWithRetry<OzonPostingsListResponse>(
            {
              method: 'POST',
              url: `${OZON_API_BASE}/v3/posting/fbs/list`,
              timeout: 30_000,
              headers: this.headers(credentials),
              data: {
                dir: 'ASC',
                filter: {
                  since: sinceDate.toISOString(),
                  to: toDate.toISOString(),
                  status: 'awaiting_deliver',
                },
                limit,
                offset,
              },
            },
            {},
          ),
        );

        const postings = page.result?.postings ?? [];
        all.push(...postings.map((p) => this.mapPostingToOrder(p)));
        hasNext = page.result?.has_next === true && postings.length >= limit;
        offset += limit;
      }

      return all;
    } catch (error) {
      throwSyncFailed('OZON', 'getOrders', error);
    }
  }

  async getPostingDetail(
    credentials: Record<string, string>,
    postingNumber: string,
  ): Promise<MarketplaceOrder> {
    try {
      const data = await withRateLimit('OZON', this.rpm(), async () =>
        axiosWithRetry<OzonPostingGetResponse>(
          {
            method: 'POST',
            url: `${OZON_API_BASE}/v3/posting/fbs/get`,
            timeout: 30_000,
            headers: this.headers(credentials),
            data: {
              posting_number: postingNumber,
              with: { analytics_data: false, financial_data: false },
            },
          },
          {},
        ),
      );
      const posting = data.result;
      if (!posting) {
        throw new Error('Ozon: gönderi bulunamadı');
      }
      return this.mapPostingToOrder(posting);
    } catch (error) {
      throwSyncFailed('OZON', 'getPostingDetail', error);
    }
  }

  async reportShipping(
    credentials: Record<string, string>,
    postingNumber: string,
    trackingNumber: string,
  ): Promise<void> {
    try {
      await withRateLimit('OZON', this.rpm(), async () => {
        await axiosWithRetry<OzonShipResponse>(
          {
            method: 'POST',
            url: `${OZON_API_BASE}/v2/posting/fbs/ship`,
            timeout: 30_000,
            headers: this.headers(credentials),
            data: {
              packages: [
                {
                  posting_number: postingNumber,
                  tracking_number: trackingNumber,
                },
              ],
            },
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('OZON', 'reportShipping', error);
    }
  }

  private mapPostingToOrder(p: OzonPosting): MarketplaceOrder {
    const id =
      typeof p.posting_number === 'string' ? p.posting_number : 'unknown';
    const created =
      typeof p.in_process_at === 'string' && p.in_process_at.length > 0
        ? new Date(p.in_process_at).toISOString()
        : new Date().toISOString();
    const products = Array.isArray(p.products) ? p.products : [];
    const currency =
      p.financial_data?.posting_services?.products_currency_code ?? 'RUB';
    let total = 0;
    const items = products.map((pr) => {
      const price = parseMoney(pr.price);
      const qty =
        typeof pr.quantity === 'number' && Number.isFinite(pr.quantity)
          ? Math.max(0, Math.round(pr.quantity))
          : 0;
      total += price * (qty > 0 ? qty : 1);
      const offer = typeof pr.offer_id === 'string' ? pr.offer_id : '';
      return {
        sku: offer,
        barcode: offer,
        quantity: qty > 0 ? qty : 1,
        unitPrice: price,
        platformItemId: String(pr.sku ?? offer),
        productName: typeof pr.name === 'string' ? pr.name : undefined,
      };
    });
    return {
      platformOrderId: id,
      status: typeof p.status === 'string' ? p.status : 'awaiting_deliver',
      customerName: '—',
      items,
      totalAmount: total,
      currency,
      createdAt: created,
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const limit = 100;
      return await withRateLimit('OZON', this.rpm(), async () => {
        const data = await axiosWithRetry<OzonProductListResponse>(
          {
            method: 'POST',
            url: `${OZON_API_BASE}/v3/product/list`,
            timeout: 30_000,
            headers: this.headers(credentials),
            data: {
              filter: { visibility: 'ALL' },
              last_id: page > 0 ? String(page) : '',
              limit,
            },
          },
          {},
        );
        const rows = data.result?.items ?? [];
        const items: MarketplaceListing[] = rows.map((r) => {
          const offerId = typeof r.offer_id === 'string' ? r.offer_id : '';
          const pid = typeof r.product_id === 'number' ? String(r.product_id) : offerId;
          const title = typeof r.name === 'string' ? r.name : offerId;
          const qty =
            typeof r.stocks?.present === 'number' && Number.isFinite(r.stocks.present)
              ? Math.max(0, Math.round(r.stocks.present))
              : 0;
          const price = parseMoney(r.price);
          return {
            platformProductId: pid,
            barcode: offerId.length > 0 ? offerId : pid,
            title,
            quantity: qty,
            salePrice: price,
            listPrice: price,
            approved: true,
            images: [],
          };
        });
        const total =
          typeof data.result?.total === 'number' && Number.isFinite(data.result.total)
            ? data.result.total
            : items.length;
        return { items, total, page, pageSize: limit };
      });
    } catch (error) {
      throwSyncFailed('OZON', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const warehouseId = this.resolveWarehouseId(credentials);
      await withRateLimit('OZON', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${OZON_API_BASE}/v1/product/import/stocks`,
            timeout: 30_000,
            headers: this.headers(credentials),
            data: {
              stocks: updates.map((u) => ({
                offer_id: u.barcode,
                stock: u.quantity,
                warehouse_id: warehouseId,
              })),
            },
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('OZON', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      await withRateLimit('OZON', this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${OZON_API_BASE}/v1/product/import/prices`,
            timeout: 30_000,
            headers: this.headers(credentials),
            data: {
              prices: updates.map((u) => ({
                offer_id: u.barcode,
                price: String(u.salePrice),
                old_price: '0',
                min_price: '0',
              })),
            },
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('OZON', 'updatePrice', error);
    }
  }
}
