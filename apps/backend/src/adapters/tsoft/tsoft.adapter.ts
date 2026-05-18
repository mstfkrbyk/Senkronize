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

import { TSOFT_API_PATH } from './tsoft.constants';
import type { TsoftOrderRow, TsoftProductRow } from './tsoft.types';

const TSOFT_STATUS_MAP: Record<string, string> = {
  '1': 'NEW',
  '2': 'PICKING',
  '3': 'SHIPPED',
  '5': 'DELIVERED',
  '7': 'CANCELLED',
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PRODUCT_PAGES = 80;

function normalizeStoreBase(storeUrl: string): string {
  return storeUrl.trim().replace(/\/+$/, '');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toNum(v: string | number | undefined): number {
  if (v === undefined) {
    return 0;
  }
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: string | number | undefined): string {
  if (v === undefined) {
    return '';
  }
  return String(v);
}

function extractOrdersPayload(data: unknown): TsoftOrderRow[] {
  if (Array.isArray(data)) {
    return data as TsoftOrderRow[];
  }
  if (!isRecord(data)) {
    return [];
  }
  const candidates: unknown[] = [
    data.orders,
    data.order,
    data.data,
    data.items,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c as TsoftOrderRow[];
    }
    if (isRecord(c)) {
      const inner = c.orders ?? c.order ?? c.items;
      if (Array.isArray(inner)) {
        return inner as TsoftOrderRow[];
      }
    }
  }
  return [];
}

function extractProductsPayload(data: unknown): TsoftProductRow[] {
  if (Array.isArray(data)) {
    return data as TsoftProductRow[];
  }
  if (!isRecord(data)) {
    return [];
  }
  const candidates: unknown[] = [
    data.products,
    data.product,
    data.data,
    data.items,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c as TsoftProductRow[];
    }
    if (isRecord(c)) {
      const inner = c.products ?? c.product ?? c.items;
      if (Array.isArray(inner)) {
        return inner as TsoftProductRow[];
      }
    }
  }
  return [];
}

function extractTotal(data: unknown, fallback: number): number {
  if (!isRecord(data)) {
    return fallback;
  }
  const raw =
    data.total ??
    (isRecord(data.data) ? data.data.total : undefined) ??
    data.total_count;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

@Injectable()
export class TsoftAdapter implements IMarketplaceAdapter, IErpAdapter {
  readonly platform = 'TSOFT';
  readonly erpType = 'TSOFT';
  private readonly logger = new Logger(TsoftAdapter.name);

  private getClient(storeUrl: string, apiKey: string): AxiosInstance {
    const base = `${normalizeStoreBase(storeUrl)}${TSOFT_API_PATH}`;
    return axios.create({
      baseURL: base,
      headers: {
        'X-Oc-Merchant-Id': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 25_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const storeUrl = credentials.storeUrl?.trim();
      const apiKey = credentials.apiKey?.trim();
      if (!storeUrl || !apiKey) {
        return false;
      }
      const client = this.getClient(storeUrl, apiKey);
      const { status } = await client.get('/sale/ordercount');
      return status === 200;
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
    if (!storeUrl || !apiKey) {
      return [];
    }
    const client = this.getClient(storeUrl, apiKey);
    const params: Record<string, string> = {};
    if (since) {
      const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
      const d = since;
      params.start_date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    let data: unknown;
    try {
      const res = await client.get<unknown>('/sale/order', { params });
      data = res.data;
    } catch (error) {
      this.logger.warn('T-Soft sipariş listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
    const rows = extractOrdersPayload(data);
    return rows.map((o) => this.mapOrder(o));
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!storeUrl || !apiKey) {
      return {
        items: [],
        total: 0,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      };
    }
    const client = this.getClient(storeUrl, apiKey);
    const apiPage = page + 1;
    let data: unknown;
    try {
      const res = await client.get<unknown>('/product', {
        params: { page: apiPage, limit: DEFAULT_PAGE_SIZE },
      });
      data = res.data;
    } catch (error) {
      this.logger.warn('T-Soft ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return {
        items: [],
        total: 0,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      };
    }
    const rows = extractProductsPayload(data);
    const items = rows.map((p) => this.mapListing(p));
    const total = extractTotal(
      data,
      page * DEFAULT_PAGE_SIZE + items.length,
    );
    return {
      items,
      total,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    };
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
    if (!storeUrl || !apiKey) {
      throw new Error('T-Soft: storeUrl ve apiKey zorunludur');
    }
    const client = this.getClient(storeUrl, apiKey);
    const idMap = await this.resolveProductIdsByBarcodes(
      credentials,
      updates.map((u) => u.barcode),
    );
    for (const u of updates) {
      const key = this.barcodeKey(u.barcode);
      const pid = idMap.get(key);
      if (!pid) {
        this.logger.warn('T-Soft stok güncelleme: barkod için ürün id bulunamadı', {
          barcode: u.barcode,
        });
        continue;
      }
      try {
        await client.put(`/product/${pid}/quantity`, {
          quantity: u.quantity,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Bilinmeyen hata';
        this.logger.error('T-Soft stok güncelleme başarısız', {
          productId: pid,
          error: message,
        });
        throw new Error(`T-Soft stok güncellenemedi: ${message}`);
      }
    }
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
    if (!storeUrl || !apiKey) {
      throw new Error('T-Soft: storeUrl ve apiKey zorunludur');
    }
    const client = this.getClient(storeUrl, apiKey);
    const idMap = await this.resolveProductIdsByBarcodes(
      credentials,
      updates.map((u) => u.barcode),
    );
    for (const u of updates) {
      const key = this.barcodeKey(u.barcode);
      const pid = idMap.get(key);
      if (!pid) {
        this.logger.warn('T-Soft fiyat güncelleme: barkod için ürün id bulunamadı', {
          barcode: u.barcode,
        });
        continue;
      }
      try {
        await client.put(`/product/${pid}/price`, {
          price: u.salePrice,
          list_price: u.listPrice,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Bilinmeyen hata';
        this.logger.error('T-Soft fiyat güncelleme başarısız', {
          productId: pid,
          error: message,
        });
        throw new Error(`T-Soft fiyat güncellenemedi: ${message}`);
      }
    }
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
    throw new NotImplementedException('T-Soft fatura oluşturma henüz desteklenmiyor');
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }

  private mapOrder(o: TsoftOrderRow): MarketplaceOrder {
    const orderId = toStr(o.order_id ?? o.id);
    const statusRaw = toStr(o.status_id ?? o.status);
    const status = TSOFT_STATUS_MAP[statusRaw] ?? 'NEW';
    const first = (o.firstname ?? '').trim();
    const last = (o.lastname ?? '').trim();
    const customerName = `${first} ${last}`.trim() || '—';
    const lines = o.products ?? o.product ?? [];
    const items = lines.map((l) => {
      const sku = (l.model ?? l.sku ?? '').trim() || orderId;
      const barcode = (l.model ?? l.sku ?? sku).trim();
      return {
        sku,
        barcode,
        quantity: Math.max(0, Math.round(toNum(l.quantity))),
        unitPrice: toNum(l.price),
        platformItemId: toStr(l.order_product_id ?? l.product_id ?? sku),
        productName: l.name,
      };
    });
    return {
      platformOrderId: orderId,
      status,
      customerName,
      items,
      totalAmount: toNum(o.total),
      currency: (o.currency_code ?? 'TRY').trim() || 'TRY',
      createdAt: o.date_added
        ? new Date(o.date_added).toISOString()
        : new Date().toISOString(),
    };
  }

  private mapListing(p: TsoftProductRow): MarketplaceListing {
    const id = toStr(p.product_id ?? p.id);
    const model = (p.model ?? p.sku ?? id).trim();
    const title = (p.name ?? model).trim() || model;
    const qty = Math.max(0, Math.round(toNum(p.quantity)));
    const price = toNum(p.price);
    const approved = p.status === undefined || String(p.status) === '1';
    const img = p.image ?? p.thumb;
    const images = img ? [img] : [];
    return {
      platformProductId: id,
      barcode: model || id,
      title,
      quantity: qty,
      salePrice: price,
      listPrice: price,
      approved,
      images,
    };
  }

  private barcodeKey(barcode: string): string {
    return barcode.trim().toLowerCase();
  }

  private async resolveProductIdsByBarcodes(
    credentials: Record<string, string>,
    barcodes: string[],
  ): Promise<Map<string, string>> {
    const wanted = new Set(
      barcodes.map((b) => this.barcodeKey(b)).filter((k) => k.length > 0),
    );
    const out = new Map<string, string>();
    if (wanted.size === 0) {
      return out;
    }
    let page = 0;
    for (let i = 0; i < MAX_PRODUCT_PAGES; i += 1) {
      const batch = await this.getListings(credentials, page);
      for (const l of batch.items) {
        const k = this.barcodeKey(l.barcode);
        const k2 = this.barcodeKey(l.platformProductId);
        if (wanted.has(k)) {
          out.set(k, l.platformProductId);
        }
        if (wanted.has(k2)) {
          out.set(k2, l.platformProductId);
        }
      }
      if (
        batch.items.length === 0 ||
        batch.items.length < batch.pageSize ||
        out.size >= wanted.size
      ) {
        break;
      }
      page += 1;
    }
    return out;
  }
}
