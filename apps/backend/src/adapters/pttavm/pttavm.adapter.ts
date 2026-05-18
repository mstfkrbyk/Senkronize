import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { PTTAVM_BASE_URL } from './pttavm.constants';
import type { PttavmOrderRow, PttavmProductRow, PttavmProductsListResponse } from './pttavm.types';

function parseMoney(value: string | number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeOrdersPayload(data: unknown): PttavmOrderRow[] {
  if (Array.isArray(data)) {
    return data as PttavmOrderRow[];
  }
  if (typeof data === 'object' && data !== null && 'orders' in data) {
    const inner = (data as { orders?: unknown }).orders;
    if (Array.isArray(inner)) {
      return inner as PttavmOrderRow[];
    }
  }
  return [];
}

function normalizeProductsPayload(
  data: unknown,
): { products: PttavmProductRow[]; totalCount?: number } {
  if (Array.isArray(data)) {
    return { products: data as PttavmProductRow[] };
  }
  if (typeof data === 'object' && data !== null) {
    const d = data as PttavmProductsListResponse;
    if (Array.isArray(d.products)) {
      return { products: d.products, totalCount: d.totalCount };
    }
  }
  return { products: [] };
}

@Injectable()
export class PttavmAdapter implements IMarketplaceAdapter {
  readonly platform = 'PTTAVM';
  private readonly logger = new Logger(PttavmAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    return axios.create({
      baseURL: PTTAVM_BASE_URL,
      headers: {
        Authorization: `Token ${credentials.apiKey}`,
        'Store-Id': credentials.storeId,
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { apiKey, storeId } = credentials;
      if (!apiKey || !storeId) {
        return false;
      }
      await this.getClient(credentials).get('/seller/info');
      return true;
    } catch (error) {
      this.logger.warn('Pttavm bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const startDate = since
      ? since.toISOString().split('T')[0]
      : new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const { data } = await this.getClient(credentials).get<unknown>('/orders', {
      params: { startDate, status: 'approved', page: 1, perPage: 100 },
    });
    const rows = normalizeOrdersPayload(data);
    return rows.flatMap((o, index) => {
      const id = o.id ?? o.orderId;
      if (id === undefined || id === null) {
        this.logger.warn('Pttavm sipariş kaydında id eksik', { index });
        return [];
      }
      const idStr = String(id);
      const name = o.buyer?.fullName ?? '';
      const createdRaw = o.createdAt ?? o.orderDate;
      return [
        {
          platformOrderId: idStr,
          status: o.status ?? 'APPROVED',
          customerName: name.length > 0 ? name : '—',
          items: [],
          totalAmount: parseMoney(o.totalPrice ?? o.amount),
          currency: 'TRY',
          createdAt:
            createdRaw !== undefined && createdRaw !== null
              ? new Date(createdRaw).toISOString()
              : new Date().toISOString(),
          cargoTrackingNumber: undefined,
          cargoProvider: undefined,
        },
      ];
    });
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const apiPage = page + 1;
    const { data } = await this.getClient(credentials).get<unknown>('/products', {
      params: { page: apiPage, per_page: 50 },
    });
    const { products, totalCount } = normalizeProductsPayload(data);
    const items: MarketplaceListing[] = products.map((p) => {
      const id = p.id !== undefined && p.id !== null ? String(p.id) : '';
      const barcode = p.barcode ?? id;
      const title = p.name ?? p.title ?? barcode;
      const sale = parseMoney(p.salePrice ?? p.price);
      return {
        platformProductId: id.length > 0 ? id : barcode,
        barcode,
        title,
        quantity: typeof p.stockAmount === 'number' ? p.stockAmount : 0,
        salePrice: sale,
        listPrice: sale,
        approved: String(p.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
        images: [],
      };
    });
    return {
      items,
      total: typeof totalCount === 'number' ? totalCount : items.length,
      page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    await this.getClient(credentials).put('/products/update-stock', {
      products: updates.map((u) => ({
        barcode: u.barcode,
        stockAmount: u.quantity,
      })),
    });
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    await this.getClient(credentials).put('/products/update-price', {
      products: updates.map((u) => ({
        barcode: u.barcode,
        salePrice: u.salePrice,
        marketPrice: u.listPrice,
      })),
    });
  }
}
