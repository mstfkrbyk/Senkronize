import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type {
  ErpInvoice,
  ErpProduct,
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { TSOFT_TOKEN_PATH, tsoftApiBase } from './tsoft.constants';

const DEFAULT_LIST_PAGE_SIZE = 50;
const MAX_PRODUCT_PAGES = 80;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toFiniteNumber(v: unknown, fallback = 0): number {
  const n =
    typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function unwrapOrderRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    return [];
  }
  const keys = ['orders', 'data', 'items', 'order'] as const;
  for (const k of keys) {
    const v = payload[k];
    if (Array.isArray(v)) {
      return v;
    }
    if (isRecord(v)) {
      const inner = v.orders ?? v.items ?? v.data;
      if (Array.isArray(inner)) {
        return inner;
      }
    }
  }
  return [];
}

function unwrapProductRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    return [];
  }
  const keys = ['products', 'data', 'items', 'product'] as const;
  for (const k of keys) {
    const v = payload[k];
    if (Array.isArray(v)) {
      return v;
    }
    if (isRecord(v)) {
      const inner = v.products ?? v.items ?? v.data;
      if (Array.isArray(inner)) {
        return inner;
      }
    }
  }
  return [];
}

function totalFromPayload(payload: unknown, itemsLen: number): number {
  if (!isRecord(payload)) {
    return itemsLen;
  }
  const raw = payload.totalCount ?? payload.total;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : itemsLen;
}

@Injectable()
export class TsoftAdapter implements IMarketplaceAdapter {
  readonly platform = 'TSOFT';
  readonly erpType = 'TSOFT';
  private readonly logger = new Logger(TsoftAdapter.name);

  private normalizeStoreUrl(storeUrl: string): string {
    return storeUrl.trim().replace(/\/+$/, '');
  }

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const storeUrl = this.normalizeStoreUrl(credentials.storeUrl ?? '');
    const apiKey = credentials.apiKey?.trim() ?? '';
    const apiSecret = credentials.apiSecret?.trim() ?? '';
    const base = tsoftApiBase(storeUrl);
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: apiSecret,
    });
    const { data } = await axios.post<{ access_token?: string }>(
      `${base}${TSOFT_TOKEN_PATH}`,
      body,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      },
    );
    const token = data.access_token;
    if (!token) {
      throw new Error('T-Soft: access_token alanı yok');
    }
    return token;
  }

  private getClient(storeUrl: string, token: string): AxiosInstance {
    return axios.create({
      baseURL: tsoftApiBase(this.normalizeStoreUrl(storeUrl)),
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const storeUrl = credentials.storeUrl?.trim();
      const apiKey = credentials.apiKey?.trim();
      const apiSecret = credentials.apiSecret?.trim();
      if (!storeUrl || !apiKey || !apiSecret) {
        return false;
      }
      await this.getToken(credentials);
      return true;
    } catch (error) {
      this.logger.warn('T-Soft bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!storeUrl || !apiKey || !apiSecret) {
      return [];
    }
    try {
      const token = await this.getToken(credentials);
      const client = this.getClient(storeUrl, token);
      const startDate = since
        ? since.toISOString().split('T')[0]
        : new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];
      const { data } = await client.get<unknown>('/orders', {
        params: { startDate, pageIndex: 0, pageSize: 100 },
      });
      const rows = unwrapOrderRows(data);
      return rows
        .map((row) =>
          isRecord(row) ? this.mapOrderRow(row) : null,
        )
        .filter((o): o is MarketplaceOrder => o !== null);
    } catch (error) {
      this.logger.warn('T-Soft sipariş listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  private mapOrderRow(o: Record<string, unknown>): MarketplaceOrder | null {
    const orderId = String(o.id ?? o.orderId ?? '');
    if (!orderId) {
      return null;
    }
    const status = String(o.status ?? o.orderStatus ?? 'NEW');
    const customer = isRecord(o.customer) ? o.customer : {};
    const fullFromParts = `${String(customer.firstName ?? '')} ${String(customer.lastName ?? '')}`.trim();
    const customerName =
      String(customer.fullName ?? '').trim() || fullFromParts || '—';
    const rawLines = o.orderItems ?? o.items;
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const items = lines.map((li, idx) => {
      const row = isRecord(li) ? li : {};
      const sku = String(
        row.barcode ?? row.sku ?? row.productCode ?? orderId,
      );
      const qty = toFiniteNumber(row.quantity, 0);
      const unit = toFiniteNumber(row.price ?? row.unitPrice, 0);
      const platformItemId = String(
        row.id ?? row.orderItemId ?? `${orderId}-${idx}`,
      );
      const nameRaw = row.name ?? row.productName;
      return {
        sku,
        barcode: sku,
        quantity: Math.max(0, Math.round(qty)),
        unitPrice: unit,
        platformItemId,
        productName: nameRaw != null ? String(nameRaw) : undefined,
      };
    });
    const totalAmount = toFiniteNumber(o.totalPrice ?? o.total, 0);
    const currency = String(o.currency ?? 'TRY') || 'TRY';
    const createdRaw = o.createdAt ?? o.orderDate;
    const createdAt =
      typeof createdRaw === 'string' || typeof createdRaw === 'number'
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    return {
      platformOrderId: orderId,
      status,
      customerName,
      items,
      totalAmount,
      currency,
      createdAt,
    };
  }

  private mapProductRow(p: Record<string, unknown>): MarketplaceListing {
    const id = String(p.id ?? p.productId ?? '');
    const barcode = String(p.barcode ?? p.sku ?? p.productCode ?? id);
    const title = String(p.name ?? p.productName ?? p.title ?? barcode);
    const salePrice = toFiniteNumber(p.salePrice ?? p.price, 0);
    const listPrice = toFiniteNumber(
      p.listPrice ?? p.compareAtPrice ?? p.regularPrice ?? salePrice,
      salePrice,
    );
    const qty = Math.max(
      0,
      Math.round(toFiniteNumber(p.stockAmount ?? p.stock, 0)),
    );
    const active = p.isActive === true || p.isActive === undefined;
    return {
      platformProductId: id || barcode,
      barcode,
      title,
      quantity: qty,
      salePrice,
      listPrice,
      approved: active,
      images: [],
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!storeUrl || !apiKey || !apiSecret) {
      return {
        items: [],
        total: 0,
        page,
        pageSize: DEFAULT_LIST_PAGE_SIZE,
      };
    }
    try {
      const token = await this.getToken(credentials);
      const { data } = await this
        .getClient(storeUrl, token)
        .get<unknown>('/products', {
          params: {
            pageIndex: page,
            pageSize: DEFAULT_LIST_PAGE_SIZE,
            isActive: true,
          },
        });
      const rows = unwrapProductRows(data).filter(isRecord);
      const items = rows.map((r) => this.mapProductRow(r));
      const total = totalFromPayload(data, page * DEFAULT_LIST_PAGE_SIZE + items.length);
      return {
        items,
        total,
        page,
        pageSize: DEFAULT_LIST_PAGE_SIZE,
      };
    } catch (error) {
      this.logger.warn('T-Soft ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return {
        items: [],
        total: 0,
        page,
        pageSize: DEFAULT_LIST_PAGE_SIZE,
      };
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!storeUrl || !apiKey || !apiSecret) {
      throw new Error('T-Soft: storeUrl, apiKey ve apiSecret zorunludur');
    }
    const token = await this.getToken(credentials);
    await this.getClient(storeUrl, token).post('/stock/update', {
      stocks: updates.map((u) => ({
        barcode: u.barcode,
        stockAmount: u.quantity,
      })),
    });
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!storeUrl || !apiKey || !apiSecret) {
      throw new Error('T-Soft: storeUrl, apiKey ve apiSecret zorunludur');
    }
    const token = await this.getToken(credentials);
    await this.getClient(storeUrl, token).post('/price/update', {
      prices: updates.map((u) => ({
        barcode: u.barcode,
        salePrice: u.salePrice,
        listPrice: u.listPrice,
      })),
    });
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const all: ErpProduct[] = [];
    let page = 0;
    let guard = 0;
    while (guard < MAX_PRODUCT_PAGES) {
      guard += 1;
      const batch = await this.getListings(credentials, page);
      for (const l of batch.items) {
        all.push({
          erpProductId: l.platformProductId,
          barcode: l.barcode,
          name: l.title,
          stockQuantity: l.quantity,
          purchasePrice: l.listPrice,
        });
      }
      if (
        batch.items.length === 0 ||
        batch.items.length < batch.pageSize ||
        all.length >= batch.total
      ) {
        break;
      }
      page += 1;
    }
    return all;
  }

  async createInvoice(
    _credentials: Record<string, string>,
    _invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    throw new NotImplementedException(
      'T-Soft fatura oluşturma henüz desteklenmiyor',
    );
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}
