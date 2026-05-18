import { Injectable, Logger } from '@nestjs/common';
import type { AxiosRequestConfig } from 'axios';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';
import { isRecord, parseMoney } from '../stub-helpers';
import type { PrestaShopXmlRoot } from './prestashop.types';

@Injectable()
export class PrestashopAdapter implements IMarketplaceAdapter {
  readonly platform = 'PRESTASHOP';
  private readonly logger = new Logger(PrestashopAdapter.name);

  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  });

  private readonly xmlBuilder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
  });

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.PRESTASHOP ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private apiBase(storeUrl: string): string {
    return `${storeUrl.replace(/\/+$/, '').trim()}/api`;
  }

  private basicAuth(apiKey: string): Pick<AxiosRequestConfig, 'headers'> {
    const token = Buffer.from(`${apiKey}:`, 'utf8').toString('base64');
    return {
      headers: {
        Authorization: `Basic ${token}`,
      },
    };
  }

  private parseXml(body: string): PrestaShopXmlRoot {
    return this.xmlParser.parse(body) as PrestaShopXmlRoot;
  }

  private ordersFromParsed(root: PrestaShopXmlRoot): unknown[] {
    if (!isRecord(root)) {
      return [];
    }
    const ps = root.prestashop;
    if (!isRecord(ps)) {
      return [];
    }
    const orders = ps.orders;
    if (!isRecord(orders)) {
      return [];
    }
    const order = orders.order;
    if (order === undefined || order === null) {
      return [];
    }
    return Array.isArray(order) ? order : [order];
  }

  private productsFromParsed(root: PrestaShopXmlRoot): unknown[] {
    if (!isRecord(root)) {
      return [];
    }
    const ps = root.prestashop;
    if (!isRecord(ps)) {
      return [];
    }
    const products = ps.products;
    if (!isRecord(products)) {
      return [];
    }
    const product = products.product;
    if (product === undefined || product === null) {
      return [];
    }
    return Array.isArray(product) ? product : [product];
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const storeUrl = credentials.storeUrl?.trim();
      const apiKey = credentials.apiKey?.trim();
      if (!storeUrl || !apiKey) {
        return false;
      }
      const url = `${this.apiBase(storeUrl)}/?schema=blank`;
      await axiosWithRetry<string>(
        { method: 'GET', url, timeout: 12_000, ...this.basicAuth(apiKey) },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('PrestaShop bağlantı testi başarısız', {
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
    const sinceDate = since ?? new Date(Date.now() - 7 * 86_400_000);
    const from = `${sinceDate.toISOString().slice(0, 19).replace('T', ' ')}`;
    const range = `[${from},9999-12-31 23:59:59]`;
    try {
      const url = `${this.apiBase(storeUrl)}/orders?display=full&sort=[date_add_DESC]&filter[date_add]=${encodeURIComponent(range)}`;
      const xml = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<string>(
          { method: 'GET', url, timeout: 30_000, ...this.basicAuth(apiKey) },
          { maxRetries: 2 },
        );
      });
      const parsed = this.parseXml(xml);
      const rows = this.ordersFromParsed(parsed);
      return rows
        .map((row) => this.mapOrder(row))
        .filter((o): o is MarketplaceOrder => o !== null);
    } catch (error) {
      this.logger.warn('PrestaShop sipariş çekme başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const id = row.id;
    if (id === undefined || id === null) {
      return null;
    }
    const ref = String(row.reference ?? id);
    const total = parseMoney(row.total_paid ?? row.total_paid_tax_incl);
    const currency = String(row.id_currency ?? 'TRY');
    const dateAdd = String(row.date_add ?? new Date().toISOString());
    const associations = isRecord(row.associations) ? row.associations : undefined;
    const orderRows = associations && isRecord(associations.order_rows)
      ? associations.order_rows
      : undefined;
    const lineContainer = orderRows && isRecord(orderRows.order_row)
      ? orderRows.order_row
      : undefined;
    const lines = Array.isArray(lineContainer)
      ? lineContainer
      : lineContainer
        ? [lineContainer]
        : [];
    const items = lines.map((li) => {
      if (!isRecord(li)) {
        return {
          sku: '',
          barcode: '',
          quantity: 0,
          unitPrice: 0,
          platformItemId: '',
        };
      }
      const sku = String(li.product_reference ?? li.product_id ?? '');
      const qty = parseMoney(li.product_quantity);
      const unit = parseMoney(li.unit_price_tax_incl ?? li.unit_price_tax_excl);
      return {
        sku,
        barcode: sku || String(li.product_id ?? ''),
        quantity: qty,
        unitPrice: unit,
        platformItemId: String(li.id ?? li.product_id ?? sku),
        productName:
          typeof li.product_name === 'string' ? li.product_name : undefined,
      };
    });
    return {
      platformOrderId: String(id),
      status: String(row.current_state ?? row.valid ?? ''),
      customerName: ref,
      items,
      totalAmount: total,
      currency,
      createdAt: new Date(dateAdd.replace(' ', 'T')).toISOString(),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!storeUrl || !apiKey) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const pageSize = 50;
    const offset = page * pageSize;
    try {
      const limitParam = `${String(offset)},${String(pageSize)}`;
      const url = `${this.apiBase(storeUrl)}/products?display=full&limit=${encodeURIComponent(limitParam)}`;
      const xml = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<string>(
          { method: 'GET', url, timeout: 30_000, ...this.basicAuth(apiKey) },
          { maxRetries: 2 },
        );
      });
      const parsed = this.parseXml(xml);
      const rows = this.productsFromParsed(parsed);
      const items = rows
        .map((r) => this.mapProduct(r))
        .filter((l): l is MarketplaceListing => l !== null);
      return { items, total: items.length, page, pageSize };
    } catch (error) {
      this.logger.warn('PrestaShop ürün listesi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { items: [], total: 0, page, pageSize };
    }
  }

  private mapProduct(row: unknown): MarketplaceListing | null {
    if (!isRecord(row)) {
      return null;
    }
    const id = row.id;
    if (id === undefined || id === null) {
      return null;
    }
    const ref = String(row.reference ?? id);
    const name =
      typeof row.name === 'object' && row.name !== null && isRecord(row.name)
        ? String(row.name.language ?? ref)
        : String(row.name ?? ref);
    const qty = parseMoney(row.quantity ?? row.quantity_available);
    const price = parseMoney(row.price);
    return {
      platformProductId: String(id),
      barcode: ref,
      title: name,
      quantity: qty,
      salePrice: price,
      listPrice: price,
      approved: String(row.active ?? '1') === '1',
      images: [],
    };
  }

  private async resolveProductIdByReference(
    storeUrl: string,
    apiKey: string,
    reference: string,
  ): Promise<string | null> {
    const url = `${this.apiBase(storeUrl)}/products?display=[id,reference]&filter[reference]=[${encodeURIComponent(reference)}]`;
    const xml = await axiosWithRetry<string>(
      { method: 'GET', url, timeout: 20_000, ...this.basicAuth(apiKey) },
      { maxRetries: 1 },
    );
    const parsed = this.parseXml(xml);
    const rows = this.productsFromParsed(parsed);
    const first = rows[0];
    if (!isRecord(first) || first.id === undefined || first.id === null) {
      return null;
    }
    return String(first.id);
  }

  private async resolveStockAvailableId(
    storeUrl: string,
    apiKey: string,
    productId: string,
  ): Promise<string | null> {
    const url = `${this.apiBase(storeUrl)}/stock_availables?display=full&filter[id_product]=[${encodeURIComponent(productId)}]`;
    const xml = await axiosWithRetry<string>(
      { method: 'GET', url, timeout: 20_000, ...this.basicAuth(apiKey) },
      { maxRetries: 1 },
    );
    const parsed = this.parseXml(xml);
    if (!isRecord(parsed)) {
      return null;
    }
    const ps = parsed.prestashop;
    if (!isRecord(ps)) {
      return null;
    }
    const stockAvailables = ps.stock_availables;
    if (!isRecord(stockAvailables)) {
      return null;
    }
    const sa = stockAvailables.stock_available;
    const row = Array.isArray(sa) ? sa[0] : sa;
    if (!isRecord(row) || row.id === undefined || row.id === null) {
      return null;
    }
    return String(row.id);
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!storeUrl || !apiKey) {
      return;
    }
    for (const u of updates) {
      const ref = u.barcode.trim();
      if (!ref) {
        continue;
      }
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          const productId = await this.resolveProductIdByReference(
            storeUrl,
            apiKey,
            ref,
          );
          if (!productId) {
            return;
          }
          const stockAvailableId = await this.resolveStockAvailableId(
            storeUrl,
            apiKey,
            productId,
          );
          if (!stockAvailableId) {
            return;
          }
          const bodyObj = {
            prestashop: {
              stock_available: {
                id: stockAvailableId,
                quantity: String(u.quantity),
              },
            },
          };
          const xml = this.xmlBuilder.build(bodyObj) as string;
          const url = `${this.apiBase(storeUrl)}/stock_availables/${encodeURIComponent(stockAvailableId)}`;
          await axiosWithRetry<string>(
            {
              method: 'PUT',
              url,
              data: xml,
              timeout: 20_000,
              headers: {
                ...this.basicAuth(apiKey).headers,
                'Content-Type': 'application/xml',
              },
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('PrestaShop stok güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const storeUrl = credentials.storeUrl?.trim();
    const apiKey = credentials.apiKey?.trim();
    if (!storeUrl || !apiKey) {
      return;
    }
    for (const u of updates) {
      const ref = u.barcode.trim();
      if (!ref) {
        continue;
      }
      try {
        await withRateLimit(this.platform, this.rpm(), async () => {
          const productId = await this.resolveProductIdByReference(
            storeUrl,
            apiKey,
            ref,
          );
          if (!productId) {
            return;
          }
          const bodyObj = {
            prestashop: {
              product: {
                id: productId,
                price: String(u.salePrice),
              },
            },
          };
          const xml = this.xmlBuilder.build(bodyObj) as string;
          const url = `${this.apiBase(storeUrl)}/products/${encodeURIComponent(productId)}`;
          await axiosWithRetry<string>(
            {
              method: 'PUT',
              url,
              data: xml,
              timeout: 20_000,
              headers: {
                ...this.basicAuth(apiKey).headers,
                'Content-Type': 'application/xml',
              },
            },
            { maxRetries: 2 },
          );
        });
      } catch (error) {
        this.logger.warn('PrestaShop fiyat güncellemesi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }
}
