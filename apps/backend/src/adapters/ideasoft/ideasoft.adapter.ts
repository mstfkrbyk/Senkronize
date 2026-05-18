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

import { IDEASOFT_API_PATH } from './ideasoft.constants';
import type {
  IdeasoftOrder,
  IdeasoftOrderLine,
  IdeasoftOrdersResponse,
  IdeasoftProduct,
  IdeasoftProductsResponse,
  IdeasoftTokenResponse,
} from './ideasoft.types';

@Injectable()
export class IdeasoftAdapter implements IMarketplaceAdapter {
  readonly platform = 'IDEASOFT';
  private readonly logger = new Logger(IdeasoftAdapter.name);

  private normalizeStoreUrl(storeUrl: string): string {
    return storeUrl.replace(/\/+$/, '');
  }

  private getClient(storeUrl: string, token: string): AxiosInstance {
    const base = `${this.normalizeStoreUrl(storeUrl)}${IDEASOFT_API_PATH}`;
    return axios.create({
      baseURL: base,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15_000,
    });
  }

  private async fetchAccessToken(
    storeUrl: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const base = this.normalizeStoreUrl(storeUrl);
    const tokenUrl = `${base}${IDEASOFT_API_PATH}/oauth/token`;
    const { data } = await axios.post<IdeasoftTokenResponse>(
      tokenUrl,
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15_000,
      },
    );
    const token = data.access_token;
    if (!token) {
      throw new Error('İdeasoft: access_token alınamadı');
    }
    return token;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const storeUrl = credentials.storeUrl;
      const apiKey = credentials.apiKey;
      const apiSecret = credentials.apiSecret;
      if (!storeUrl || !apiKey || !apiSecret) {
        return false;
      }
      const token = await this.fetchAccessToken(storeUrl, apiKey, apiSecret);
      const client = this.getClient(storeUrl, token);
      await client.get('/store');
      return true;
    } catch (error) {
      this.logger.warn('İdeasoft bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const storeUrl = credentials.storeUrl;
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!storeUrl || !apiKey || !apiSecret) {
      return [];
    }
    const token = await this.fetchAccessToken(storeUrl, apiKey, apiSecret);
    const client = this.getClient(storeUrl, token);
    const begin = (since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .toISOString()
      .slice(0, 19);
    const { data } = await client.get<IdeasoftOrdersResponse>('/orders', {
      params: {
        createDateBegin: begin,
        page: 1,
        limit: 100,
      },
    });
    const list = data.data ?? data.items ?? [];
    return list.map((o) => this.mapOrder(o));
  }

  private mapOrder(o: IdeasoftOrder): MarketplaceOrder {
    const lines = o.items ?? o.orderItems ?? [];
    const items = lines.map((l: IdeasoftOrderLine) => {
      const sku = String(l.sku ?? l.barcode ?? '');
      const barcode = String(l.barcode ?? l.sku ?? '');
      const qty = Number(l.quantity ?? 0);
      const unit = Number(l.unitPrice ?? l.price ?? 0);
      return {
        sku,
        barcode,
        quantity: Number.isFinite(qty) ? qty : 0,
        unitPrice: Number.isFinite(unit) ? unit : 0,
        platformItemId: String(l.id ?? barcode),
        productName: l.name,
      };
    });
    const total = Number(o.total ?? o.totalAmount ?? 0);
    const cust = o.customer;
    const name =
      String(o.customerName ?? cust?.fullName ?? cust?.name ?? '').trim() ||
      '—';
    const created = String(o.createdAt ?? o.createDate ?? new Date().toISOString());
    return {
      platformOrderId: String(o.id ?? ''),
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
    const storeUrl = credentials.storeUrl;
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!storeUrl || !apiKey || !apiSecret) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const token = await this.fetchAccessToken(storeUrl, apiKey, apiSecret);
    const client = this.getClient(storeUrl, token);
    const ideasoftPage = page + 1;
    const { data } = await client.get<IdeasoftProductsResponse>('/products', {
      params: { page: ideasoftPage, limit: 50 },
    });
    const products = data.data ?? data.items ?? [];
    const total = Number(
      data.meta?.total ?? data.meta?.itemCount ?? data.total ?? products.length,
    );
    return {
      items: products.map((p) => this.mapProduct(p)),
      total: Number.isFinite(total) ? total : products.length,
      page,
      pageSize: 50,
    };
  }

  private mapProduct(p: IdeasoftProduct): MarketplaceListing {
    const barcode = String(p.barcode ?? '');
    const title = String(p.title ?? p.name ?? barcode);
    const qty = Number(p.stockAmount ?? p.quantity ?? 0);
    const sale = Number(p.price ?? 0);
    const list = Number(p.oldPrice ?? p.listPrice ?? sale);
    const images: string[] = [];
    if (Array.isArray(p.images)) {
      for (const im of p.images) {
        if (typeof im === 'string') {
          images.push(im);
        } else if (im?.url) {
          images.push(im.url);
        }
      }
    }
    return {
      platformProductId: String(p.id ?? barcode),
      barcode,
      title,
      quantity: Number.isFinite(qty) ? qty : 0,
      salePrice: Number.isFinite(sale) ? sale : 0,
      listPrice: Number.isFinite(list) ? list : sale,
      approved: true,
      images,
    };
  }

  private async resolveProductId(
    client: AxiosInstance,
    barcode: string,
  ): Promise<string> {
    const { data } = await client.get<IdeasoftProductsResponse>('/products', {
      params: { barcode, limit: 1 },
    });
    const products = data.data ?? data.items ?? [];
    const first = products[0];
    if (!first?.id) {
      throw new Error(`İdeasoft: barkod için ürün bulunamadı (${barcode})`);
    }
    return String(first.id);
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const storeUrl = credentials.storeUrl;
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!storeUrl || !apiKey || !apiSecret) {
      throw new Error('İdeasoft stok: storeUrl / apiKey / apiSecret eksik');
    }
    const token = await this.fetchAccessToken(storeUrl, apiKey, apiSecret);
    const client = this.getClient(storeUrl, token);
    for (const u of updates) {
      const id = await this.resolveProductId(client, u.barcode);
      await client.put(`/products/${id}/stock`, {
        stockAmount: u.quantity,
      });
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const storeUrl = credentials.storeUrl;
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!storeUrl || !apiKey || !apiSecret) {
      throw new Error('İdeasoft fiyat: storeUrl / apiKey / apiSecret eksik');
    }
    const token = await this.fetchAccessToken(storeUrl, apiKey, apiSecret);
    const client = this.getClient(storeUrl, token);
    for (const u of updates) {
      const id = await this.resolveProductId(client, u.barcode);
      await client.put(`/products/${id}`, {
        price: u.salePrice,
        oldPrice: u.listPrice,
      });
    }
  }
}
