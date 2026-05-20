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
  mapIdeasoftStatus,
  toMarketplaceOrder,
  type NormalizedOrder,
} from '../../common/order-normalizer';
import {
  isRecord,
  normalizeArrayPayload,
  parseMoney,
  totalFromPayload,
} from '../ecommerce-adapter.utils';

import {
  ideasoftApiBase,
  resolveIdeasoftDomain,
} from './ideasoft.constants';
import { fetchIdeasoftAccessToken } from './ideasoft.oauth';
import type {
  IdeasoftOrder,
  IdeasoftOrderLine,
  IdeasoftProduct,
} from './ideasoft.types';

const PAGE_SIZE = 100;
const ORDER_STATUS_FILTER = '1,2,3';

function pickString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return '';
}

function normalizeIdeasoftOrderRow(row: unknown): NormalizedOrder | null {
  if (!isRecord(row)) {
    return null;
  }
  const order = row as IdeasoftOrder;
  const externalId = pickString(row, 'id');
  if (!externalId) {
    return null;
  }
  const linesRaw = order.items ?? order.orderItems;
  const lines = Array.isArray(linesRaw) ? linesRaw : [];
  const customer = order.customer;
  const rawStatus = String(order.status ?? order.order_status_id ?? '');
  const ship = order.shippingAddress;
  return {
    externalId,
    externalOrderNo: pickString(row, 'orderNumber', 'order_number') || externalId,
    platform: EcommerceType.IDEASOFT,
    rawStatus,
    status: mapIdeasoftStatus(rawStatus),
    customer: {
      name:
        String(order.customerName ?? customer?.fullName ?? customer?.name ?? '').trim() ||
        '—',
      email: String(customer?.email ?? order.customerEmail ?? ''),
      phone: typeof customer?.phone === 'string' ? customer.phone : undefined,
    },
    shippingAddress: {
      line1: String(ship?.address ?? ship?.fullAddress ?? ''),
      city: String(ship?.city ?? ''),
      country: String(ship?.country ?? 'TR'),
    },
    items: lines.map((line) => {
      const li = line as IdeasoftOrderLine;
      const sku = String(li.sku ?? li.barcode ?? '');
      return {
        sku,
        name: String(li.name ?? sku),
        qty: Math.max(0, Math.round(parseMoney(li.quantity))),
        unitPrice: parseMoney(li.unitPrice ?? li.price),
      };
    }),
    totalAmount: parseMoney(order.total ?? order.totalAmount),
    currency: String(order.currency ?? 'TRY'),
    createdAt: new Date(String(order.createdAt ?? order.createDate ?? Date.now())),
    trackingNumber:
      typeof order.trackingNumber === 'string' ? order.trackingNumber : undefined,
    cargoProvider:
      typeof order.cargoCompany === 'string' ? order.cargoCompany : undefined,
  };
}

function mapIdeasoftOrder(row: unknown): MarketplaceOrder | null {
  const normalized = normalizeIdeasoftOrderRow(row);
  return normalized ? toMarketplaceOrder(normalized) : null;
}

function mapIdeasoftProduct(row: unknown): MarketplaceListing | null {
  if (!isRecord(row)) {
    return null;
  }
  const product = row as IdeasoftProduct;
  const id = pickString(row, 'id');
  if (!id) {
    return null;
  }
  const barcode = String(product.barcode ?? product.sku ?? id);
  const salePrice = parseMoney(product.price);
  const listPrice = parseMoney(product.oldPrice ?? product.listPrice ?? salePrice);
  const images: string[] = [];
  if (Array.isArray(product.images)) {
    for (const image of product.images) {
      if (typeof image === 'string') {
        images.push(image);
      } else if (isRecord(image) && typeof image.url === 'string') {
        images.push(image.url);
      }
    }
  }
  return {
    platformProductId: id,
    barcode,
    title: String(product.title ?? product.name ?? barcode),
    quantity: Math.max(
      0,
      Math.round(parseMoney(product.stock ?? product.stockAmount ?? product.quantity)),
    ),
    salePrice,
    listPrice,
    approved: product.status !== 0 && product.status !== '0',
    images,
  };
}

@Injectable()
export class IdeasoftEcommerceAdapter implements IEcommerceAdapter {
  readonly platform = 'IDEASOFT';
  private readonly logger = new Logger(IdeasoftEcommerceAdapter.name);

  private hasOAuthCredentials(credentials: Record<string, string>): boolean {
    const domain = resolveIdeasoftDomain(credentials);
    const clientId = credentials.clientId?.trim() ?? credentials.apiKey?.trim();
    const clientSecret =
      credentials.clientSecret?.trim() ?? credentials.apiSecret?.trim();
    return Boolean(domain && clientId && clientSecret);
  }

  private async resolveAccessToken(credentials: Record<string, string>): Promise<string> {
    const cached = credentials.accessToken?.trim();
    const expiresRaw = credentials.tokenExpiresAt?.trim();
    if (cached && expiresRaw) {
      const expiresAt = Number.parseInt(expiresRaw, 10);
      if (Number.isFinite(expiresAt) && Date.now() < expiresAt - 60_000) {
        return cached;
      }
    }
    const tokens = await fetchIdeasoftAccessToken(credentials);
    credentials.accessToken = tokens.accessToken;
    credentials.tokenExpiresAt = String(tokens.tokenExpiresAt);
    return tokens.accessToken;
  }

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const token = await this.resolveAccessToken(credentials);
    return axios.create({
      baseURL: ideasoftApiBase(credentials),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    if (!this.hasOAuthCredentials(credentials)) {
      return false;
    }
    try {
      const client = await this.getClient(credentials);
      await client.get('/products', {
        params: { limit: 1, offset: 0, status: 1 },
        timeout: 12_000,
      });
      return true;
    } catch (error) {
      this.logger.warn('IdeaSoft bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    _since?: Date,
  ): Promise<MarketplaceOrder[]> {
    if (!this.hasOAuthCredentials(credentials)) {
      return [];
    }
    const client = await this.getClient(credentials);
    const all: MarketplaceOrder[] = [];
    let offset = 0;
    let guard = 0;
    while (guard < 50) {
      guard += 1;
      try {
        const { data } = await client.get<unknown>('/orders', {
          params: {
            limit: PAGE_SIZE,
            offset,
            order_status_id: ORDER_STATUS_FILTER,
          },
        });
        const rows = normalizeArrayPayload(data);
        const mapped = rows
          .map((row) => mapIdeasoftOrder(row))
          .filter((o): o is MarketplaceOrder => o !== null);
        all.push(...mapped);
        if (mapped.length < PAGE_SIZE) {
          break;
        }
        offset += PAGE_SIZE;
      } catch (error) {
        this.logger.warn('IdeaSoft sipariş listesi alınamadı', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          offset,
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
    if (!this.hasOAuthCredentials(credentials)) {
      return null;
    }
    try {
      const client = await this.getClient(credentials);
      const { data } = await client.get<unknown>(
        `/orders/${encodeURIComponent(orderId)}`,
      );
      return normalizeIdeasoftOrderRow(data);
    } catch (error) {
      this.logger.warn('IdeaSoft sipariş detayı alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return null;
    }
  }

  /** @deprecated getOrderById kullanın */
  async getOrderDetail(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<MarketplaceOrder | null> {
    const normalized = await this.getOrderById(credentials, orderId);
    return normalized ? toMarketplaceOrder(normalized) : null;
  }

  async updateOrderStatus(
    credentials: Record<string, string>,
    orderId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.hasOAuthCredentials(credentials)) {
      throw new Error('IdeaSoft: OAuth kimlik bilgileri eksik');
    }
    const client = await this.getClient(credentials);
    await client.put(`/orders/${encodeURIComponent(orderId)}`, payload);
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    if (!this.hasOAuthCredentials(credentials)) {
      return { items: [], total: 0, page, pageSize: PAGE_SIZE };
    }
    try {
      const client = await this.getClient(credentials);
      const offset = page * PAGE_SIZE;
      const { data } = await client.get<unknown>('/products', {
        params: { limit: PAGE_SIZE, offset, status: 1 },
      });
      const rows = normalizeArrayPayload(data);
      const items = rows
        .map((row) => mapIdeasoftProduct(row))
        .filter((p): p is MarketplaceListing => p !== null);
      return {
        items,
        total: totalFromPayload(data, offset + items.length),
        page,
        pageSize: PAGE_SIZE,
      };
    } catch (error) {
      this.logger.warn('IdeaSoft ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize: PAGE_SIZE };
    }
  }

  private async resolveProductId(
    client: AxiosInstance,
    barcode: string,
  ): Promise<string> {
    const { data } = await client.get<unknown>('/products', {
      params: { barcode, limit: 1, offset: 0 },
    });
    const rows = normalizeArrayPayload(data);
    const first = rows[0];
    if (!isRecord(first)) {
      throw new Error(`IdeaSoft: barkod için ürün bulunamadı (${barcode})`);
    }
    const id = pickString(first, 'id');
    if (!id) {
      throw new Error(`IdeaSoft: barkod için ürün bulunamadı (${barcode})`);
    }
    return id;
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    if (updates.length === 0 || !this.hasOAuthCredentials(credentials)) {
      return;
    }
    const client = await this.getClient(credentials);
    for (const update of updates) {
      try {
        const productId = await this.resolveProductId(client, update.barcode);
        await client.put(`/products/${encodeURIComponent(productId)}/stock-status`, {
          stock: update.quantity,
          stock_type_id: 1,
        });
      } catch (error) {
        this.logger.warn('IdeaSoft stok güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    if (updates.length === 0 || !this.hasOAuthCredentials(credentials)) {
      return;
    }
    const client = await this.getClient(credentials);
    for (const update of updates) {
      try {
        const productId = await this.resolveProductId(client, update.barcode);
        await client.put(`/products/${encodeURIComponent(productId)}/prices`, {
          price: update.salePrice,
          currency_code: 'TRY',
        });
      } catch (error) {
        this.logger.warn('IdeaSoft fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
