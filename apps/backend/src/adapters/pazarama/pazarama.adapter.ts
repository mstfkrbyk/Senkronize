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

import { PAZARAMA_API_URL, PAZARAMA_BASE_URL } from './pazarama.constants';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseMoney(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeOrdersRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (isRecord(data)) {
    if (Array.isArray(data.data)) {
      return data.data;
    }
    if (Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data.orders)) {
      return data.orders;
    }
  }
  return [];
}

function normalizeProductRows(data: unknown): { rows: unknown[]; total?: number } {
  if (Array.isArray(data)) {
    return { rows: data };
  }
  if (isRecord(data)) {
    const rows = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.products)
          ? data.products
          : [];
    const totalRaw = data.totalCount ?? data.total ?? data.count;
    const total =
      typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : undefined;
    return { rows, total };
  }
  return { rows: [] };
}

@Injectable()
export class PazaramaAdapter implements IMarketplaceAdapter {
  readonly platform = 'PAZARAMA';
  private readonly logger = new Logger(PazaramaAdapter.name);

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error('Pazarama: apiKey zorunludur');
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: apiKey,
    });
    const { data } = await axios.post<unknown>(PAZARAMA_BASE_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    });
    if (!isRecord(data) || typeof data.access_token !== 'string') {
      throw new Error('Pazarama: access_token alınamadı');
    }
    return data.access_token;
  }

  private async getApiClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const token = await this.getToken(credentials);
    const supplierId = credentials.supplierId?.trim();
    return axios.create({
      baseURL: PAZARAMA_API_URL,
      ...(supplierId ? { params: { supplierId } } : {}),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.getToken(credentials);
      return true;
    } catch (error) {
      this.logger.warn('Pazarama bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const client = await this.getApiClient(credentials);
    const { data } = await client.get<unknown>('/orders', {
      params: { page: 1, pageSize: 100 },
    });
    const rows = normalizeOrdersRows(data);
    const sinceMs = since ? since.getTime() : null;
    return rows.flatMap((row, index) => {
      const o = isRecord(row) ? row : {};
      const idRaw = o.id ?? o.orderId;
      if (idRaw === undefined || idRaw === null) {
        this.logger.warn('Pazarama sipariş kaydında id eksik', { index });
        return [];
      }
      const idStr = String(idRaw);
      const createdRaw = o.createdAt ?? o.orderDate;
      const createdAt =
        createdRaw !== undefined && createdRaw !== null
          ? new Date(String(createdRaw)).toISOString()
          : new Date().toISOString();
      if (sinceMs !== null) {
        const t = Date.parse(createdAt);
        if (!Number.isNaN(t) && t < sinceMs) {
          return [];
        }
      }
      const nameRaw = o.customerName ?? o.buyerName ?? '';
      const customerName =
        typeof nameRaw === 'string' && nameRaw.length > 0 ? nameRaw : '—';
      return [
        {
          platformOrderId: idStr,
          status: typeof o.status === 'string' ? o.status : 'NEW',
          customerName,
          items: [],
          totalAmount: parseMoney(o.totalPrice ?? o.totalAmount),
          currency: 'TRY',
          createdAt,
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
    const client = await this.getApiClient(credentials);
    const apiPage = page + 1;
    const { data } = await client.get<unknown>('/products', {
      params: { page: apiPage, pageSize: 50 },
    });
    const { rows, total } = normalizeProductRows(data);
    const items: MarketplaceListing[] = rows.map((row, i) => {
      const p = isRecord(row) ? row : {};
      const idRaw = p.id ?? p.productId;
      const id =
        idRaw !== undefined && idRaw !== null ? String(idRaw) : `row-${i}`;
      const barcodeRaw = p.barcode ?? p.sku ?? id;
      const barcode =
        typeof barcodeRaw === 'string'
          ? barcodeRaw
          : typeof barcodeRaw === 'number'
            ? String(barcodeRaw)
            : id;
      const titleRaw = p.name ?? p.title ?? barcode;
      const title = typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
      const sale = parseMoney(p.salePrice ?? p.price);
      const qtyRaw = p.stockCount ?? p.stock ?? p.quantity ?? 0;
      const quantity =
        typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
          ? Math.max(0, Math.round(qtyRaw))
          : 0;
      const statusStr =
        typeof p.status === 'string' ? p.status.toUpperCase() : 'ACTIVE';
      return {
        platformProductId: id,
        barcode,
        title,
        quantity,
        salePrice: sale,
        listPrice: sale,
        approved: statusStr === 'ACTIVE',
        images: [],
      };
    });
    return {
      items,
      total: typeof total === 'number' ? total : items.length,
      page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = await this.getApiClient(credentials);
    await client.put('/products/stock', {
      items: updates.map((u) => ({ barcode: u.barcode, stockCount: u.quantity })),
    });
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const client = await this.getApiClient(credentials);
    await client.put('/products/price', {
      items: updates.map((u) => ({
        barcode: u.barcode,
        salePrice: u.salePrice,
      })),
    });
  }
}
