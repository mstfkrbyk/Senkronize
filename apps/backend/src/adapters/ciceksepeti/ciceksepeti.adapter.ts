import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { randomUUID } from 'node:crypto';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  CICEKSEPETI_OMS_BASE_URL,
  CICEKSEPETI_ORDER_STATUS_NEW,
  CICEKSEPETI_TOKEN_URL,
} from './ciceksepeti.constants';
import type {
  CiceksepetiOrder,
  CiceksepetiOrderLine,
  CiceksepetiOrdersResponse,
  CiceksepetiProduct,
  CiceksepetiProductsResponse,
  CiceksepetiTokenResponse,
} from './ciceksepeti.types';

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class CiceksepetiAdapter implements IMarketplaceAdapter {
  readonly platform = 'CICEKSEPETI';
  private readonly logger = new Logger(CiceksepetiAdapter.name);
  private readonly tokenCache = new Map<string, CachedToken>();

  private async fetchAccessToken(apiKey: string): Promise<string> {
    const cached = this.tokenCache.get(apiKey);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.token;
    }
    const { data } = await axios.post<CiceksepetiTokenResponse>(
      CICEKSEPETI_TOKEN_URL,
      { apiKey },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15_000,
        validateStatus: (s) => s >= 200 && s < 300,
      },
    );
    const token =
      (typeof data.accessToken === 'string' && data.accessToken) ||
      (typeof data.token === 'string' && data.token) ||
      (typeof data.access_token === 'string' && data.access_token) ||
      '';
    if (!token) {
      throw new Error('Çiçeksepeti token yanıtında erişim anahtarı yok');
    }
    const ttlSec =
      typeof data.expiresIn === 'number'
        ? data.expiresIn
        : typeof data.expires_in === 'number'
          ? data.expires_in
          : 3600;
    this.tokenCache.set(apiKey, {
      token,
      expiresAt: Date.now() + ttlSec * 1000,
    });
    return token;
  }

  private async getClient(apiKey: string): Promise<AxiosInstance> {
    const token = await this.fetchAccessToken(apiKey);
    return axios.create({
      baseURL: CICEKSEPETI_OMS_BASE_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-request-id': randomUUID(),
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiKey = credentials.apiKey;
      if (!apiKey) {
        return false;
      }
      const client = await this.getClient(apiKey);
      await client.get('/v1/orders', {
        params: {
          status: CICEKSEPETI_ORDER_STATUS_NEW,
          pageNumber: 0,
          pageSize: 1,
        },
      });
      return true;
    } catch (error) {
      this.logger.warn('Çiçeksepeti bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      return [];
    }
    const client = await this.getClient(apiKey);
    const end = new Date();
    const start = since ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pageSize = 20;
    const all: MarketplaceOrder[] = [];

    for (let pageNumber = 0; ; pageNumber += 1) {
      const { data } = await client.get<CiceksepetiOrdersResponse>('/v1/orders', {
        params: {
          status: CICEKSEPETI_ORDER_STATUS_NEW,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          pageSize,
          pageNumber,
        },
      });
      const list = data.orders ?? [];
      all.push(...list.map((o) => this.mapOrder(o)));
      if (list.length < pageSize) {
        break;
      }
    }

    return all;
  }

  async reportCargo(
    credentials: Record<string, string>,
    orderId: string,
    cargoCode: string,
    trackingNumber: string,
  ): Promise<void> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error('Çiçeksepeti kargo: apiKey eksik');
    }
    const client = await this.getClient(apiKey);
    await client.put(`/v1/orders/${encodeURIComponent(orderId)}/cargo`, {
      cargoCode,
      trackingNumber,
    });
  }

  private mapOrder(o: CiceksepetiOrder): MarketplaceOrder {
    const lines = o.orderItems ?? o.items ?? [];
    const items = lines.map((l: CiceksepetiOrderLine) => {
      const sku = String(l.productCode ?? l.barcode ?? '');
      const barcode = String(l.barcode ?? l.productCode ?? '');
      const qty = Number(l.quantity ?? 0);
      const unit = Number(l.unitPrice ?? l.totalPrice ?? 0);
      return {
        sku,
        barcode,
        quantity: Number.isFinite(qty) ? qty : 0,
        unitPrice: Number.isFinite(unit) ? unit : 0,
        platformItemId: String(l.orderItemId ?? l.barcode ?? ''),
        productName: l.productName,
      };
    });
    const total = Number(o.totalPrice ?? o.orderTotal ?? 0);
    const name =
      String(o.customerName ?? o.receiverName ?? '').trim() || '—';
    const created = String(
      o.orderCreateDate ?? o.createDate ?? new Date().toISOString(),
    );
    return {
      platformOrderId: String(o.orderId ?? o.orderCode ?? ''),
      status: String(o.status ?? ''),
      customerName: name,
      items,
      totalAmount: Number.isFinite(total) ? total : 0,
      currency: String(o.currency ?? 'TRY'),
      createdAt: created,
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const client = await this.getClient(apiKey);
    const { data } = await client.get<CiceksepetiProductsResponse>('/v1/products', {
      params: { pageNumber: page, pageSize: 50 },
    });
    const products = data.products ?? [];
    const total = Number(data.totalCount ?? products.length);
    return {
      items: products.map((p) => this.mapProduct(p)),
      total: Number.isFinite(total) ? total : products.length,
      page,
      pageSize: 50,
    };
  }

  private mapProduct(p: CiceksepetiProduct): MarketplaceListing {
    const barcode = String(p.barcode ?? p.productCode ?? '');
    const title = String(p.productName ?? p.name ?? barcode);
    const qty = Number(p.stockQuantity ?? p.quantity ?? 0);
    const sale = Number(p.salesPrice ?? 0);
    const list = Number(p.listPrice ?? sale);
    const approved = p.isActive === true || p.active === true;
    const images: string[] = [];
    if (Array.isArray(p.images)) {
      for (const im of p.images) {
        if (typeof im === 'string') {
          images.push(im);
        } else if (
          im &&
          typeof im === 'object' &&
          'url' in im &&
          typeof im.url === 'string'
        ) {
          images.push(im.url);
        }
      }
    }
    return {
      platformProductId: String(p.productCode ?? barcode),
      barcode,
      title,
      quantity: Number.isFinite(qty) ? qty : 0,
      salePrice: Number.isFinite(sale) ? sale : 0,
      listPrice: Number.isFinite(list) ? list : sale,
      approved,
      images,
    };
  }

  private async updateProductStockAndPrice(
    credentials: Record<string, string>,
    productCode: string,
    quantity?: number,
    price?: number,
  ): Promise<void> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error('Çiçeksepeti güncelleme: apiKey eksik');
    }
    const client = await this.getClient(apiKey);
    const body: { quantity?: number; price?: number } = {};
    if (quantity !== undefined) {
      body.quantity = quantity;
    }
    if (price !== undefined) {
      body.price = price;
    }
    await client.put(
      `/v1/products/${encodeURIComponent(productCode)}/stock`,
      body,
    );
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    for (const u of updates) {
      const code = u.barcode.trim();
      if (!code) {
        continue;
      }
      await this.updateProductStockAndPrice(credentials, code, u.quantity);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    for (const u of updates) {
      const code = u.barcode.trim();
      if (!code) {
        continue;
      }
      await this.updateProductStockAndPrice(
        credentials,
        code,
        undefined,
        u.salePrice,
      );
    }
  }
}
