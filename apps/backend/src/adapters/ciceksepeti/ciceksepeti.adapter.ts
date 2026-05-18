import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { CICEKSEPETI_BASE_URL } from './ciceksepeti.constants';
import type {
  CiceksepetiOrder,
  CiceksepetiOrderLine,
  CiceksepetiOrdersResponse,
  CiceksepetiProduct,
  CiceksepetiProductsResponse,
} from './ciceksepeti.types';

@Injectable()
export class CiceksepetiAdapter implements IMarketplaceAdapter {
  readonly platform = 'CICEKSEPETI';
  private readonly logger = new Logger(CiceksepetiAdapter.name);

  private getClient(apiKey: string): AxiosInstance {
    return axios.create({
      baseURL: CICEKSEPETI_BASE_URL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
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
      const client = this.getClient(apiKey);
      await client.get('/supplier');
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
    const client = this.getClient(apiKey);
    const end = new Date();
    const start = since ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const params: Record<string, string | number> = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      pageNumber: 0,
      pageSize: 100,
    };
    const { data } = await client.get<CiceksepetiOrdersResponse>('/orders', {
      params,
    });
    const list = data.orders ?? [];
    return list.map((o) => this.mapOrder(o));
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
    const client = this.getClient(apiKey);
    const { data } = await client.get<CiceksepetiProductsResponse>('/products', {
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

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error('Çiçeksepeti stok: apiKey eksik');
    }
    const client = this.getClient(apiKey);
    await client.put('/products/stock-price-update', {
      items: updates.map((u) => ({
        barcode: u.barcode,
        stockCount: u.quantity,
      })),
    });
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error('Çiçeksepeti fiyat: apiKey eksik');
    }
    const client = this.getClient(apiKey);
    await client.put('/products/stock-price-update', {
      items: updates.map((u) => ({
        barcode: u.barcode,
        salesPrice: u.salePrice,
        listPrice: u.listPrice,
      })),
    });
  }
}
