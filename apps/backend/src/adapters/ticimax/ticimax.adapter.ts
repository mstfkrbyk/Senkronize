import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type {
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { ticimaxApiBase } from './ticimax.constants';

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
  const keys = ['orders', 'data', 'items', 'Orders'] as const;
  for (const k of keys) {
    const v = payload[k];
    if (Array.isArray(v)) {
      return v;
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
  const keys = ['Products', 'products', 'data', 'items'] as const;
  for (const k of keys) {
    const v = payload[k];
    if (Array.isArray(v)) {
      return v;
    }
  }
  return [];
}

function totalFromPayload(payload: unknown, itemsLen: number): number {
  if (!isRecord(payload)) {
    return itemsLen;
  }
  const raw = payload.TotalCount ?? payload.totalCount ?? payload.total;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : itemsLen;
}

@Injectable()
export class TicimaxAdapter implements IMarketplaceAdapter, IErpAdapter {
  readonly platform = 'TICIMAX';
  readonly erpType = 'TICIMAX';
  private readonly logger = new Logger(TicimaxAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiUrl = (credentials.apiUrl ?? '').trim();
    const apiKey = credentials.apiKey?.trim() ?? '';
    return axios.create({
      baseURL: ticimaxApiBase(apiUrl),
      headers: {
        ApiKey: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    const apiUrl = credentials.apiUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!apiUrl || !apiKey) {
      return false;
    }
    try {
      await this.getClient(credentials).get('/Products', {
        params: { pageIndex: 0, pageSize: 1 },
      });
      return true;
    } catch (error) {
      this.logger.warn('Ticimax bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const apiUrl = credentials.apiUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!apiUrl || !apiKey) {
      return [];
    }
    try {
      const startDate = since
        ? since.toISOString()
        : new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data } = await this.getClient(credentials).get<unknown>('/Orders', {
        params: { startDate, pageIndex: 0, pageSize: 100 },
      });
      const rows = unwrapOrderRows(data);
      return rows
        .map((row) => (isRecord(row) ? this.mapOrderRow(row) : null))
        .filter((o): o is MarketplaceOrder => o !== null);
    } catch (error) {
      this.logger.warn('Ticimax sipariş listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  private mapOrderRow(o: Record<string, unknown>): MarketplaceOrder | null {
    const orderId = String(o.Id ?? o.id ?? o.OrderId ?? '');
    if (!orderId) {
      return null;
    }
    const status = String(o.Status ?? o.status ?? 'NEW');
    const nameParts = `${String(o.FirstName ?? '')} ${String(o.LastName ?? '')}`.trim();
    const customerName =
      String(o.CustomerFullName ?? '').trim() || nameParts || '—';
    const rawLines = o.OrderItems ?? o.Items ?? o.items;
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const items = lines.map((li, idx) => {
      const row = isRecord(li) ? li : {};
      const sku = String(
        row.Barcode ?? row.barcode ?? row.ProductCode ?? row.SKU ?? orderId,
      );
      const qty = toFiniteNumber(row.Quantity ?? row.quantity, 0);
      const unit = toFiniteNumber(row.UnitPrice ?? row.Price ?? row.price, 0);
      const platformItemId = String(
        row.Id ?? row.id ?? `${orderId}-${idx}`,
      );
      const nameRaw = row.ProductName ?? row.Name ?? row.name;
      return {
        sku,
        barcode: sku,
        quantity: Math.max(0, Math.round(qty)),
        unitPrice: unit,
        platformItemId,
        productName: nameRaw != null ? String(nameRaw) : undefined,
      };
    });
    const totalAmount = toFiniteNumber(
      o.TotalPrice ?? o.Total ?? o.total ?? 0,
      0,
    );
    const createdRaw = o.CreatedDate ?? o.OrderDate ?? o.createdAt;
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
      currency: 'TRY',
      createdAt,
    };
  }

  private mapProductRow(p: Record<string, unknown>): MarketplaceListing {
    const id = String(p.Id ?? p.id ?? '');
    const barcode = String(
      p.Barcode ?? p.barcode ?? p.Code ?? p.code ?? id,
    );
    const title = String(p.Name ?? p.ProductName ?? p.name ?? barcode);
    const salePrice = toFiniteNumber(p.SalePrice ?? p.Price ?? p.price, 0);
    const listPrice = toFiniteNumber(
      p.ListPrice ?? p.listPrice ?? salePrice,
      salePrice,
    );
    const qty = Math.max(
      0,
      Math.round(toFiniteNumber(p.StockAmount ?? p.Stock ?? p.stock, 0)),
    );
    const inactive = p.IsActive === false || p.isActive === false;
    return {
      platformProductId: id || barcode,
      barcode,
      title,
      quantity: qty,
      salePrice,
      listPrice,
      approved: !inactive,
      images: [],
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const apiUrl = credentials.apiUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!apiUrl || !apiKey) {
      return {
        items: [],
        total: 0,
        page,
        pageSize: DEFAULT_LIST_PAGE_SIZE,
      };
    }
    try {
      const { data } = await this.getClient(credentials).get<unknown>('/Products', {
        params: { pageIndex: page, pageSize: DEFAULT_LIST_PAGE_SIZE },
      });
      const rows = unwrapProductRows(data).filter(isRecord);
      const items = rows.map((r) => this.mapProductRow(r));
      const total = totalFromPayload(
        data,
        page * DEFAULT_LIST_PAGE_SIZE + items.length,
      );
      return {
        items,
        total,
        page,
        pageSize: DEFAULT_LIST_PAGE_SIZE,
      };
    } catch (error) {
      this.logger.warn('Ticimax ürün listesi alınamadı', {
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
    const apiUrl = credentials.apiUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!apiUrl || !apiKey) {
      throw new Error('Ticimax: apiUrl ve apiKey zorunludur');
    }
    await this.getClient(credentials).post(
      '/Stock/Update',
      updates.map((u) => ({
        Barcode: u.barcode,
        StockAmount: u.quantity,
      })),
    );
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    const apiUrl = credentials.apiUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!apiUrl || !apiKey) {
      throw new Error('Ticimax: apiUrl ve apiKey zorunludur');
    }
    await this.getClient(credentials).post(
      '/Price/Update',
      updates.map((u) => ({
        Barcode: u.barcode,
        SalePrice: u.salePrice,
        ListPrice: u.listPrice,
      })),
    );
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
      'Ticimax fatura oluşturma henüz desteklenmiyor',
    );
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}
