import { Injectable, Logger } from '@nestjs/common';
import { EcommerceType } from '@prisma/client';
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
  mapTicimaxStatus,
  toMarketplaceOrder,
  type NormalizedOrder,
} from '../../common/order-normalizer';
import {
  isRecord,
  normalizeArrayPayload,
  parseMoney,
  totalFromPayload,
} from '../ecommerce-adapter.utils';

import { resolveTicimaxDomain, ticimaxApiBase } from './ticimax.constants';
import type {
  TicimaxCargoPayload,
  TicimaxOrder,
  TicimaxProduct,
  TicimaxWebhookPayload,
} from './ticimax.types';

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

function normalizeTicimaxOrderRow(row: unknown): NormalizedOrder | null {
  if (!isRecord(row)) {
    return null;
  }
  const order = row as TicimaxOrder;
  const externalId = pickString(row, 'id', 'Id');
  const externalOrderNo = pickString(row, 'orderNo', 'OrderNo') || externalId;
  if (!externalId && !externalOrderNo) {
    return null;
  }
  const linesRaw = order.items ?? order.Items ?? order.orderItems ?? order.OrderItems;
  const lines = Array.isArray(linesRaw) ? linesRaw : [];
  const rawStatus = String(order.status ?? order.Status ?? 'NEW');
  const firstName = pickString(row, 'firstName', 'FirstName');
  const lastName = pickString(row, 'lastName', 'LastName');
  const customerName =
    pickString(row, 'customerName', 'CustomerName') ||
    `${firstName} ${lastName}`.trim() ||
    '—';
  const createdRaw =
    order.createdAt ?? order.CreatedAt ?? order.orderDate ?? order.OrderDate;
  return {
    externalId: externalId || externalOrderNo,
    externalOrderNo,
    platform: EcommerceType.TICIMAX,
    rawStatus,
    status: mapTicimaxStatus(rawStatus),
    customer: {
      name: customerName,
      email: pickString(row, 'email', 'Email'),
      phone: pickString(row, 'phone', 'Phone', 'gsm', 'Gsm') || undefined,
    },
    shippingAddress: {
      line1: pickString(row, 'shippingAddress', 'ShippingAddress', 'address', 'Address'),
      city: pickString(row, 'city', 'City'),
      country: pickString(row, 'country', 'Country') || 'TR',
    },
    items: lines.map((line) => {
      const li = isRecord(line) ? line : {};
      const sku = pickString(
        li,
        'productCode',
        'ProductCode',
        'barcode',
        'Barcode',
        'sku',
        'SKU',
      );
      return {
        sku,
        name:
          pickString(li, 'productName', 'ProductName', 'name', 'Name') || sku,
        qty: Math.max(0, Math.round(parseMoney(li.quantity ?? li.Quantity))),
        unitPrice: parseMoney(li.unitPrice ?? li.UnitPrice ?? li.price ?? li.Price),
      };
    }),
    totalAmount: parseMoney(
      order.totalAmount ?? order.TotalAmount ?? order.total ?? order.Total,
    ),
    currency: 'TRY',
    createdAt: new Date(String(createdRaw ?? Date.now())),
    trackingNumber:
      pickString(row, 'trackingNo', 'TrackingNo', 'cargoTrackingNo') || undefined,
    cargoProvider: pickString(row, 'cargoCompany', 'CargoCompany') || undefined,
  };
}

function mapTicimaxOrder(row: unknown): MarketplaceOrder | null {
  const normalized = normalizeTicimaxOrderRow(row);
  return normalized ? toMarketplaceOrder(normalized) : null;
}

function mapTicimaxProduct(row: unknown): MarketplaceListing | null {
  if (!isRecord(row)) {
    return null;
  }
  const product = row as TicimaxProduct;
  const productCode = pickString(
    row,
    'productCode',
    'ProductCode',
    'code',
    'Code',
    'barcode',
    'Barcode',
    'id',
    'Id',
  );
  if (!productCode) {
    return null;
  }
  const salePrice = parseMoney(
    product.salePrice ?? product.SalePrice ?? product.price ?? product.Price,
  );
  const listPrice = parseMoney(
    product.listPrice ?? product.ListPrice ?? salePrice,
  );
  const inactive =
    product.isActive === false ||
    product.IsActive === false ||
    product.status === 0 ||
    product.status === '0';
  return {
    platformProductId: productCode,
    barcode: pickString(row, 'barcode', 'Barcode') || productCode,
    title:
      pickString(row, 'name', 'Name', 'productName', 'ProductName', 'title') ||
      productCode,
    quantity: Math.max(
      0,
      Math.round(parseMoney(product.stock ?? product.Stock ?? product.stockAmount ?? product.StockAmount)),
    ),
    salePrice,
    listPrice: listPrice || salePrice,
    approved: !inactive,
    images: [],
  };
}

@Injectable()
export class TicimaxEcommerceAdapter implements IEcommerceAdapter {
  readonly platform = 'TICIMAX';
  private readonly logger = new Logger(TicimaxEcommerceAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim() ?? '';
    const baseURL = ticimaxApiBase(credentials);
    return axios.create({
      baseURL,
      headers: {
        TicimaxApiKey: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  private hasRequiredCredentials(credentials: Record<string, string>): boolean {
    return Boolean(resolveTicimaxDomain(credentials) && credentials.apiKey?.trim());
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    if (!this.hasRequiredCredentials(credentials)) {
      return false;
    }
    try {
      await this.getClient(credentials).get('/products', {
        params: { pageSize: 1, pageIndex: 0 },
        timeout: 12_000,
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
            startDate,
            endDate,
            pageSize: PAGE_SIZE,
            pageIndex,
            status: 1,
          },
        });
        const rows = normalizeArrayPayload(data);
        const mapped = rows
          .map((row) => mapTicimaxOrder(row))
          .filter((o): o is MarketplaceOrder => o !== null);
        all.push(...mapped);
        if (mapped.length < PAGE_SIZE) {
          break;
        }
        pageIndex += 1;
      } catch (error) {
        this.logger.warn('Ticimax sipariş listesi alınamadı', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          pageIndex,
        });
        break;
      }
    }
    return all;
  }

  async getOrderById(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<NormalizedOrder | null> {
    if (!this.hasRequiredCredentials(credentials)) {
      return null;
    }
    try {
      const { data } = await this.getClient(credentials).get<unknown>(
        `/orders/${encodeURIComponent(orderId)}`,
      );
      return normalizeTicimaxOrderRow(data);
    } catch (error) {
      this.logger.warn('Ticimax sipariş detayı alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return null;
    }
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
        params: { pageSize: PAGE_SIZE, pageIndex: page },
      });
      const rows = normalizeArrayPayload(data);
      const items = rows
        .map((row) => mapTicimaxProduct(row))
        .filter((p): p is MarketplaceListing => p !== null);
      return {
        items,
        total: totalFromPayload(data, page * PAGE_SIZE + items.length),
        page,
        pageSize: PAGE_SIZE,
      };
    } catch (error) {
      this.logger.warn('Ticimax ürün listesi alınamadı', {
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
    const client = this.getClient(credentials);
    for (const update of updates) {
      try {
        await client.put(`/products/${encodeURIComponent(update.barcode)}/stock`, {
          stock: update.quantity,
          quantity: update.quantity,
        });
      } catch (error) {
        this.logger.warn('Ticimax stok güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    if (updates.length === 0 || !this.hasRequiredCredentials(credentials)) {
      return;
    }
    const client = this.getClient(credentials);
    for (const update of updates) {
      try {
        await client.put(`/products/${encodeURIComponent(update.barcode)}/price`, {
          price: update.salePrice,
          salePrice: update.salePrice,
          listPrice: update.listPrice,
        });
      } catch (error) {
        this.logger.warn('Ticimax fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updateOrderCargo(
    credentials: Record<string, string>,
    orderNo: string,
    payload: TicimaxCargoPayload,
  ): Promise<void> {
    if (!this.hasRequiredCredentials(credentials)) {
      throw new Error('Ticimax: storeUrl ve apiKey zorunludur');
    }
    await this.getClient(credentials).post(
      `/orders/${encodeURIComponent(orderNo)}/cargo`,
      payload,
    );
  }

  async registerWebhook(
    credentials: Record<string, string>,
    webhookUrl: string,
    type = 'order_created',
  ): Promise<void> {
    if (!this.hasRequiredCredentials(credentials)) {
      throw new Error('Ticimax: storeUrl ve apiKey zorunludur');
    }
    const body: TicimaxWebhookPayload = { type, url: webhookUrl };
    await this.getClient(credentials).post('/webhooks', body);
  }
}
