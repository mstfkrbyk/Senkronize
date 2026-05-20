import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  mapN11Status,
  toMarketplaceOrder,
  type NormalizedOrder,
} from '../common/order-normalizer';
import { RedisRateLimiter } from '../common/redis-rate-limiter';
import {
  N11_CATALOG_SERVICE_WSDL,
  N11_ORDER_WSDL,
  N11_PRODUCT_WSDL,
  N11_WSDL_BASE,
} from './n11.constants';
import type {
  N11OrderItemXml,
  N11OrderXml,
  N11ProductXml,
  N11SoapResult,
} from './n11.types';

@Injectable()
export class N11Adapter implements IMarketplaceAdapter {
  readonly platform = 'N11';
  private readonly logger = new Logger(N11Adapter.name);
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    removeNSPrefix: true,
  });

  constructor(private readonly rateLimiter: RedisRateLimiter) {}

  private escapeXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private buildAuthXml(apiKey: string, apiSecret: string): string {
    return `<auth>
        <appKey>${this.escapeXml(apiKey)}</appKey>
        <appSecret>${this.escapeXml(apiSecret)}</appSecret>
      </auth>`;
  }

  private wrapOrderSoapBody(inner: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ord="http://www.n11.com/ws/schemas">
  <soapenv:Header/>
  <soapenv:Body>
    ${inner}
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private wrapProductSoapBody(inner: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://www.n11.com/ws/schemas">
  <soapenv:Header/>
  <soapenv:Body>
    ${inner}
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private formatN11Date(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }

  private buildGetOrderListInner(
    apiKey: string,
    apiSecret: string,
    status: string,
    startDate: Date,
    endDate: Date,
    pageNumber: number,
    pageSize = 50,
  ): string {
    return `<ord:GetOrderList>
      ${this.buildAuthXml(apiKey, apiSecret)}
      <searchData>
        <status>${this.escapeXml(status)}</status>
        <period>
          <startDate>${this.formatN11Date(startDate)}</startDate>
          <endDate>${this.formatN11Date(endDate)}</endDate>
        </period>
        <pagingData>
          <pageNumber>${String(pageNumber)}</pageNumber>
          <pageSize>${String(pageSize)}</pageSize>
        </pagingData>
      </searchData>
    </ord:GetOrderList>`;
  }

  private assertSoapSuccess(parsed: unknown, context: string): void {
    const fault = this.soapFaultMessage(parsed);
    if (fault) {
      throw new Error(`${context}: ${fault}`);
    }
    const st = this.findResultStatus(parsed);
    if (st?.status && st.status !== 'success') {
      throw new Error(`${context}: ${st.status}`);
    }
  }

  private rateLimitKey(credentials: Record<string, string>): string {
    return credentials.apiKey?.trim() || 'default';
  }

  private async postSoap(
    credentials: Record<string, string>,
    url: string,
    body: string,
  ): Promise<string> {
    await this.rateLimiter.acquireOrThrow(this.platform, this.rateLimitKey(credentials));
    const { data, status } = await axios.post<string>(url, body, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      timeout: 30_000,
      responseType: 'text',
      validateStatus: () => true,
    });
    if (status !== 200) {
      throw new Error(`N11 HTTP ${String(status)}`);
    }
    return data;
  }

  private parseXml(xml: string): unknown {
    return this.xmlParser.parse(xml) as unknown;
  }

  private soapFaultMessage(parsed: unknown): string | null {
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const root = parsed as Record<string, unknown>;
    const envelope = root.Envelope ?? root['soapenv:Envelope'];
    if (typeof envelope !== 'object' || envelope === null) {
      return null;
    }
    const env = envelope as Record<string, unknown>;
    const body = env.Body ?? env['soapenv:Body'];
    if (typeof body !== 'object' || body === null) {
      return null;
    }
    const fault = (body as Record<string, unknown>).Fault;
    if (typeof fault !== 'object' || fault === null) {
      return null;
    }
    const f = fault as Record<string, unknown>;
    const reason = f.faultstring ?? f.faultString;
    return typeof reason === 'string' ? reason : null;
  }

  private findResultStatus(obj: unknown): N11SoapResult | null {
    if (typeof obj !== 'object' || obj === null) {
      return null;
    }
    const rec = obj as Record<string, unknown>;
    if ('status' in rec && typeof rec.status === 'string') {
      return { status: rec.status, errorCode: rec.errorCode as string | undefined };
    }
    for (const v of Object.values(rec)) {
      const nested = this.findResultStatus(v);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  private ensureArray<T>(v: T | T[] | undefined): T[] {
    if (v === undefined) {
      return [];
    }
    return Array.isArray(v) ? v : [v];
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiKey = credentials.apiKey;
      const apiSecret = credentials.apiSecret;
      if (!apiKey || !apiSecret) {
        return false;
      }
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const inner = this.buildGetOrderListInner(
        apiKey,
        apiSecret,
        'New',
        start,
        end,
        0,
        1,
      );
      const xml = await this.postSoap(
        credentials,
        N11_ORDER_WSDL,
        this.wrapOrderSoapBody(inner),
      );
      const parsed = this.parseXml(xml);
      const fault = this.soapFaultMessage(parsed);
      if (fault) {
        this.logger.warn('N11 bağlantı testi SOAP Fault', { fault });
        return false;
      }
      const st = this.findResultStatus(parsed);
      return st?.status === 'success' || st === null;
    } catch (error) {
      this.logger.warn('N11 bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async fetchOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedOrder[]> {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!apiKey || !apiSecret) {
      return [];
    }

    const end = new Date();
    const start =
      since ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const statuses = ['New', 'Approved', 'Shipped'];
    const pageSize = 50;
    const all: NormalizedOrder[] = [];

    for (const status of statuses) {
      let pageNumber = 0;
      for (;;) {
        const inner = this.buildGetOrderListInner(
          apiKey,
          apiSecret,
          status,
          start,
          end,
          pageNumber,
          pageSize,
        );
        const xml = await this.postSoap(
          credentials,
          N11_ORDER_WSDL,
          this.wrapOrderSoapBody(inner),
        );
        const parsed = this.parseXml(xml);
        this.assertSoapSuccess(parsed, `N11 sipariş listesi (${status})`);
        const batch = this.extractOrdersFromParsed(parsed);
        all.push(...batch);
        if (batch.length < pageSize) {
          break;
        }
        pageNumber += 1;
      }
    }

    const sinceMs = since?.getTime() ?? 0;
    const seen = new Set<string>();
    return all.filter((o) => {
      if (o.platformCreatedAt.getTime() < sinceMs) {
        return false;
      }
      if (seen.has(o.platformOrderId)) {
        return false;
      }
      seen.add(o.platformOrderId);
      return true;
    });
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const normalized = await this.fetchOrders(credentials, since);
    return normalized.map(toMarketplaceOrder);
  }

  private extractOrdersFromParsed(parsed: unknown): NormalizedOrder[] {
    const orders = this.deepFindOrderList(parsed);
    return orders.map((o) => this.normalizeOrder(o));
  }

  private deepFindOrderList(obj: unknown): N11OrderXml[] {
    if (typeof obj !== 'object' || obj === null) {
      return [];
    }
    const rec = obj as Record<string, unknown>;
    if ('orderList' in rec) {
      const ol = rec.orderList as Record<string, unknown> | undefined;
      if (ol && 'order' in ol) {
        return this.ensureArray(ol.order as N11OrderXml);
      }
    }
    for (const v of Object.values(rec)) {
      const found = this.deepFindOrderList(v);
      if (found.length > 0) {
        return found;
      }
    }
    return [];
  }

  async getOrderDetail(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<N11OrderXml | null> {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!apiKey || !apiSecret || !orderId.trim()) {
      return null;
    }
    const inner = `<ord:GetOrderDetail>
      ${this.buildAuthXml(apiKey, apiSecret)}
      <orderRequest><id>${this.escapeXml(orderId.trim())}</id></orderRequest>
    </ord:GetOrderDetail>`;
    const xml = await this.postSoap(
      credentials,
      N11_ORDER_WSDL,
      this.wrapOrderSoapBody(inner),
    );
    const parsed = this.parseXml(xml);
    this.assertSoapSuccess(parsed, 'N11 sipariş detayı');
    const orders = this.deepFindOrderList(parsed);
    return orders[0] ?? null;
  }

  async reportShipping(
    credentials: Record<string, string>,
    orderItemId: string,
    cargoCompany: string,
    trackingNumber: string,
  ): Promise<void> {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!apiKey || !apiSecret) {
      throw new Error('N11 kargo bildirimi: apiKey/apiSecret eksik');
    }
    const inner = `<ord:UpdateOrderStatus>
      ${this.buildAuthXml(apiKey, apiSecret)}
      <orderRequest>
        <orderItemList>
          <orderItem>
            <id>${this.escapeXml(orderItemId)}</id>
            <status>Shipped</status>
            <shipmentInfo>
              <shipmentCompany>${this.escapeXml(cargoCompany)}</shipmentCompany>
              <trackingNumber>${this.escapeXml(trackingNumber)}</trackingNumber>
            </shipmentInfo>
          </orderItem>
        </orderItemList>
      </orderRequest>
    </ord:UpdateOrderStatus>`;
    const xml = await this.postSoap(
      credentials,
      N11_ORDER_WSDL,
      this.wrapOrderSoapBody(inner),
    );
    const parsed = this.parseXml(xml);
    this.assertSoapSuccess(parsed, 'N11 sipariş durum güncelleme');
  }

  private normalizeOrder(o: N11OrderXml): NormalizedOrder {
    const itemsRaw = o.orderItemList?.orderItem;
    const itemsArr = this.ensureArray(itemsRaw ?? undefined);
    const items = itemsArr.map((it: N11OrderItemXml) => {
      const sku = String(it.productSellerCode ?? '');
      const qty = Number(it.quantity ?? 0);
      const price = Number(it.price ?? 0);
      return {
        sku,
        name: String(it.productName ?? sku),
        quantity: Number.isFinite(qty) ? qty : 0,
        unitPrice: Number.isFinite(price) ? price : 0,
      };
    });
    const total = Number(o.totalAmount ?? 0);
    const createdAt = this.parseTrDate(String(o.createDate ?? ''));
    const rawStatus = String(o.status ?? 'New');
    const buyerName = String(
      o.buyer?.fullName ?? o.buyer?.name ?? '',
    ).trim();
    const ship = o.shippingAddress;
    const addressParts = [
      ship?.fullAddress,
      ship?.address,
      ship?.district,
      ship?.city,
    ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    return {
      platformOrderId: String(o.id ?? o.orderNumber ?? ''),
      rawStatus,
      status: mapN11Status(rawStatus),
      customerName: buyerName.length > 0 ? buyerName : '—',
      items,
      totalAmount: Number.isFinite(total) ? total : 0,
      currency: 'TRY',
      shippingAddress: {
        fullAddress: addressParts.join(', '),
        city: ship?.city,
        district: ship?.district,
      },
      platformCreatedAt: createdAt,
    };
  }

  private parseTrDate(s: string): Date {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(s);
    if (!m) {
      return new Date();
    }
    const [, dd, mm, yyyy, hh, min] = m;
    return new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
    );
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!apiKey || !apiSecret) {
      return { items: [], total: 0, page: 0, pageSize: 50 };
    }
    const inner = `<sch:GetProductListRequest xmlns:sch="http://www.n11.com/ws/schemas">
      ${this.buildAuthXml(apiKey, apiSecret)}
      <pagingData>
        <currentPage>${String(page)}</currentPage>
        <itemsPerPage>50</itemsPerPage>
      </pagingData>
    </sch:GetProductListRequest>`;
    const xml = await this.postSoap(
      credentials,
      N11_CATALOG_SERVICE_WSDL,
      this.wrapOrderSoapBody(inner),
    );
    const parsed = this.parseXml(xml);
    const fault = this.soapFaultMessage(parsed);
    if (fault) {
      throw new Error(`N11 ürün listesi: ${fault}`);
    }
    const { products, total, pageSize } = this.extractProductList(parsed);
    return {
      items: products.map((p) => this.mapProduct(p)),
      total,
      page,
      pageSize,
    };
  }

  private extractProductList(
    parsed: unknown,
  ): { products: N11ProductXml[]; total: number; pageSize: number } {
    const products = this.deepFindProducts(parsed);
    const paging = this.deepFindPaging(parsed);
    const total = Number(paging.totalCount ?? products.length);
    const pageSize = Number(paging.pageSize ?? 50);
    return {
      products,
      total: Number.isFinite(total) ? total : products.length,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
    };
  }

  private deepFindProducts(obj: unknown): N11ProductXml[] {
    if (typeof obj !== 'object' || obj === null) {
      return [];
    }
    const rec = obj as Record<string, unknown>;
    if ('products' in rec) {
      const pr = rec.products as Record<string, unknown> | undefined;
      if (pr && 'product' in pr) {
        return this.ensureArray(pr.product as N11ProductXml);
      }
    }
    for (const v of Object.values(rec)) {
      const found = this.deepFindProducts(v);
      if (found.length > 0) {
        return found;
      }
    }
    return [];
  }

  private deepFindPaging(obj: unknown): {
    totalCount?: string | number;
    pageSize?: string | number;
  } {
    if (typeof obj !== 'object' || obj === null) {
      return {};
    }
    const rec = obj as Record<string, unknown>;
    if ('pagingData' in rec && typeof rec.pagingData === 'object' && rec.pagingData) {
      return rec.pagingData as {
        totalCount?: string | number;
        pageSize?: string | number;
      };
    }
    for (const v of Object.values(rec)) {
      const nested = this.deepFindPaging(v);
      if (Object.keys(nested).length > 0) {
        return nested;
      }
    }
    return {};
  }

  private mapProduct(p: N11ProductXml): MarketplaceListing {
    const images: string[] = [];
    const img = p.images?.image;
    if (img) {
      for (const i of this.ensureArray(img)) {
        if (i.url) {
          images.push(i.url);
        }
      }
    }
    const barcode = String(p.barcode ?? p.productSellerCode ?? '');
    const qty = Number(p.quantity ?? 0);
    const sale = Number(p.price ?? 0);
    const list = Number(p.displayPrice ?? p.price ?? 0);
    const approved =
      String(p.saleStatus ?? '') === '1' ||
      String(p.approvalStatus ?? '') === '1' ||
      String(p.approvalStatus ?? '') === 'true';
    return {
      platformProductId: String(p.id ?? p.productSellerCode ?? barcode),
      barcode,
      title: String(p.title ?? barcode),
      quantity: Number.isFinite(qty) ? qty : 0,
      salePrice: Number.isFinite(sale) ? sale : 0,
      listPrice: Number.isFinite(list) ? list : sale,
      approved,
      images,
    };
  }

  private async updateProductPriceAndStock(
    credentials: Record<string, string>,
    barcode: string,
    quantity?: number,
    salePrice?: number,
    listPrice?: number,
  ): Promise<void> {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!apiKey || !apiSecret) {
      throw new Error('N11 güncelleme: apiKey/apiSecret eksik');
    }
    const stockXml =
      quantity !== undefined
        ? `<newStockAmount>${String(quantity)}</newStockAmount>`
        : '';
    const priceXml =
      salePrice !== undefined
        ? `<newPrice>${String(salePrice)}</newPrice>`
        : '';
    const inner = `<prod:UpdateProductPriceAndStockByProductId>
      ${this.buildAuthXml(apiKey, apiSecret)}
      <productSellerCode>${this.escapeXml(barcode)}</productSellerCode>
      ${priceXml}
      ${stockXml}
    </prod:UpdateProductPriceAndStockByProductId>`;
    const xml = await this.postSoap(
      credentials,
      N11_PRODUCT_WSDL,
      this.wrapProductSoapBody(inner),
    );
    const parsed = this.parseXml(xml);
    this.assertSoapSuccess(parsed, `N11 stok/fiyat (${barcode})`);
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    for (const u of updates) {
      await this.updateProductPriceAndStock(
        credentials,
        u.barcode,
        u.quantity,
      );
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    for (const u of updates) {
      await this.updateProductPriceAndStock(
        credentials,
        u.barcode,
        undefined,
        u.salePrice,
        u.listPrice,
      );
    }
  }
}
