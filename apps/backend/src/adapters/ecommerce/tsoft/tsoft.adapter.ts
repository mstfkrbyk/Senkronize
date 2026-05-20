import { Injectable, Logger } from '@nestjs/common';
import type {
  IEcommerceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import {
  isRecord,
  normalizeArrayPayload,
  parseMoney,
  totalFromPayload,
} from '../ecommerce-adapter.utils';

import { resolveTsoftApiKey, TSOFT_API_BASE } from './tsoft.constants';
import type { TsoftOrder, TsoftOrderLine, TsoftProduct } from './tsoft.types';

const PAGE_SIZE = 100;

function pickString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return '';
}

function mapTsoftOrder(row: unknown): MarketplaceOrder | null {
  if (!isRecord(row)) {
    return null;
  }
  const order = row as TsoftOrder;
  const platformOrderId = pickString(row, 'id', 'orderId', 'orderNo');
  if (!platformOrderId) {
    return null;
  }
  const linesRaw = order.items ?? order.orderItems;
  const lines = Array.isArray(linesRaw) ? linesRaw : [];
  const items = lines.map((line, index) => {
    const li = line as TsoftOrderLine;
    const sku = String(li.barcode ?? li.sku ?? li.productCode ?? '');
    return {
      sku,
      barcode: sku || String(index),
      quantity: Math.max(0, Math.round(parseMoney(li.quantity))),
      unitPrice: parseMoney(li.price ?? li.unitPrice),
      platformItemId: String(li.id ?? `${platformOrderId}-${String(index)}`),
      productName: li.name ?? li.productName,
    };
  });
  const customer = order.customer;
  const customerName =
    String(order.customerName ?? customer?.fullName ?? '').trim() ||
    `${String(customer?.firstName ?? '')} ${String(customer?.lastName ?? '')}`.trim() ||
    '—';
  const createdRaw = order.createdAt ?? order.orderDate;
  return {
    platformOrderId,
    status: String(order.status ?? order.orderStatus ?? 'NEW'),
    customerName,
    items,
    totalAmount: parseMoney(order.total ?? order.totalPrice),
    currency: String(order.currency ?? 'TRY'),
    createdAt: new Date(String(createdRaw ?? Date.now())).toISOString(),
  };
}

function mapTsoftProduct(row: unknown): MarketplaceListing | null {
  if (!isRecord(row)) {
    return null;
  }
  const product = row as TsoftProduct;
  const id = pickString(row, 'id', 'productId');
  const barcode = pickString(row, 'barcode', 'sku', 'productCode') || id;
  if (!barcode) {
    return null;
  }
  const salePrice = parseMoney(product.salePrice ?? product.price);
  const listPrice = parseMoney(
    product.listPrice ?? product.compareAtPrice ?? salePrice,
  );
  return {
    platformProductId: id || barcode,
    barcode,
    title: String(product.name ?? product.productName ?? product.title ?? barcode),
    quantity: Math.max(
      0,
      Math.round(parseMoney(product.stock ?? product.stockAmount)),
    ),
    salePrice,
    listPrice,
    approved: product.isActive !== false,
    images: [],
  };
}

@Injectable()
export class TsoftEcommerceAdapter implements IEcommerceAdapter {
  readonly platform = 'TSOFT';
  private readonly logger = new Logger(TsoftEcommerceAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = resolveTsoftApiKey(credentials);
    return axios.create({
      baseURL: TSOFT_API_BASE,
      headers: {
        tSoftApiKey: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  private hasRequiredCredentials(credentials: Record<string, string>): boolean {
    return Boolean(resolveTsoftApiKey(credentials));
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    if (!this.hasRequiredCredentials(credentials)) {
      return false;
    }
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      await this.getClient(credentials).get('/orders', {
        params: {
          StartDate: endDate,
          EndDate: endDate,
          PageSize: 1,
          PageIndex: 0,
        },
        timeout: 12_000,
      });
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
    if (!this.hasRequiredCredentials(credentials)) {
      return [];
    }
    const client = this.getClient(credentials);
    const startDate = (since ?? new Date(Date.now() - 7 * 86_400_000))
      .toISOString()
      .slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const all: MarketplaceOrder[] = [];
    let pageIndex = 0;
    let guard = 0;
    while (guard < 50) {
      guard += 1;
      try {
        const { data } = await client.get<unknown>('/orders', {
          params: {
            StartDate: startDate,
            EndDate: endDate,
            PageSize: PAGE_SIZE,
            PageIndex: pageIndex,
          },
        });
        const rows = normalizeArrayPayload(data);
        const mapped = rows
          .map((row) => mapTsoftOrder(row))
          .filter((o): o is MarketplaceOrder => o !== null);
        all.push(...mapped);
        if (mapped.length < PAGE_SIZE) {
          break;
        }
        pageIndex += 1;
      } catch (error) {
        this.logger.warn('T-Soft sipariş listesi alınamadı', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          pageIndex,
        });
        break;
      }
    }
    return all;
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    if (!this.hasRequiredCredentials(credentials)) {
      return { items: [], total: 0, page, pageSize: PAGE_SIZE };
    }
    try {
      const { data } = await this.getClient(credentials).get<unknown>('/products', {
        params: {
          PageSize: PAGE_SIZE,
          PageIndex: page,
        },
      });
      const rows = normalizeArrayPayload(data);
      const items = rows
        .map((row) => mapTsoftProduct(row))
        .filter((p): p is MarketplaceListing => p !== null);
      return {
        items,
        total: totalFromPayload(data, page * PAGE_SIZE + items.length),
        page,
        pageSize: PAGE_SIZE,
      };
    } catch (error) {
      this.logger.warn('T-Soft ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize: PAGE_SIZE };
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    if (updates.length === 0 || !this.hasRequiredCredentials(credentials)) {
      return;
    }
    try {
      await this.getClient(credentials).put('/products/updatestock', {
        items: updates.map((update) => ({
          barcode: update.barcode,
          stock: update.quantity,
          stockAmount: update.quantity,
        })),
      });
    } catch (error) {
      this.logger.warn('T-Soft stok güncellemesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    if (updates.length === 0 || !this.hasRequiredCredentials(credentials)) {
      return;
    }
    try {
      await this.getClient(credentials).put('/products/updateprice', {
        items: updates.map((update) => ({
          barcode: update.barcode,
          price: update.salePrice,
          salePrice: update.salePrice,
          listPrice: update.listPrice,
        })),
      });
    } catch (error) {
      this.logger.warn('T-Soft fiyat güncellemesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  }
}
