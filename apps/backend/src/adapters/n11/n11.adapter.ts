import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  N11_CATALOG_SERVICE_WSDL,
  N11_ORDER_WSDL,
  N11_PRODUCT_WSDL,
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

  private wrapSoapBody(inner: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="http://www.n11.com/ws/schemas">
  <soapenv:Header/>
  <soapenv:Body>
    ${inner}
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private async postSoap(url: string, body: string): Promise<string> {
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

  private async parseXml(xml: string): Promise<unknown> {
    return parseStringPromise(xml, {
      explicitArray: false,
      ignoreAttrs: true,
      trim: true,
    });
  }

  private soapFaultMessage(parsed: unknown): string | null {
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const root = parsed as Record<string, unknown>;
    const envelope = root['soapenv:Envelope'] ?? root['SOAP-ENV:Envelope'] ?? root.Envelope;
    if (typeof envelope !== 'object' || envelope === null) {
      return null;
    }
    const env = envelope as Record<string, unknown>;
    const body = env['soapenv:Body'] ?? env['SOAP-ENV:Body'] ?? env.Body;
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

  private formatTrDateTime(d: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiKey = credentials.apiKey;
      const apiSecret = credentials.apiSecret;
      if (!apiKey || !apiSecret) {
        return false;
      }
      const inner = `<sch:OrderListRequest>
      ${this.buildAuthXml(apiKey, apiSecret)}
      <searchData>
        <status>New</status>
      </searchData>
      <pagingData>
        <currentPage>0</currentPage>
        <pageSize>1</pageSize>
      </pagingData>
    </sch:OrderListRequest>`;
      const xml = await this.postSoap(N11_ORDER_WSDL, this.wrapSoapBody(inner));
      const parsed = await this.parseXml(xml);
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

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!apiKey || !apiSecret) {
      return [];
    }
    const end = new Date();
    const start = since ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const inner = `<sch:DetailedOrderListRequest>
      ${this.buildAuthXml(apiKey, apiSecret)}
      <searchData>
        <status>Approved</status>
        <period>
          <startDate>${this.escapeXml(this.formatTrDateTime(start))}</startDate>
          <endDate>${this.escapeXml(this.formatTrDateTime(end))}</endDate>
        </period>
      </searchData>
      <pagingData>
        <currentPage>0</currentPage>
        <pageSize>100</pageSize>
      </pagingData>
    </sch:DetailedOrderListRequest>`;
    const xml = await this.postSoap(N11_ORDER_WSDL, this.wrapSoapBody(inner));
    const parsed = await this.parseXml(xml);
    const fault = this.soapFaultMessage(parsed);
    if (fault) {
      throw new Error(`N11 sipariş listesi: ${fault}`);
    }
    const orders = this.extractOrdersFromParsed(parsed);
    const sinceMs = since?.getTime() ?? 0;
    return orders.filter((o) => {
      const t = Date.parse(o.createdAt);
      return !Number.isNaN(t) && t >= sinceMs;
    });
  }

  private extractOrdersFromParsed(parsed: unknown): MarketplaceOrder[] {
    const orders = this.deepFindOrderList(parsed);
    return orders.map((o) => this.mapOrder(o));
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

  private mapOrder(o: N11OrderXml): MarketplaceOrder {
    const itemsRaw = o.orderItemList?.orderItem;
    const itemsArr = this.ensureArray(itemsRaw ?? undefined);
    const items = itemsArr.map((it: N11OrderItemXml) => {
      const sku = String(it.productSellerCode ?? '');
      const barcode = sku;
      const qty = Number(it.quantity ?? 0);
      const price = Number(it.price ?? 0);
      return {
        sku,
        barcode,
        quantity: Number.isFinite(qty) ? qty : 0,
        unitPrice: Number.isFinite(price) ? price : 0,
        platformItemId: String(it.id ?? ''),
        productName: it.productName,
      };
    });
    const total = Number(o.totalAmount ?? 0);
    return {
      platformOrderId: String(o.id ?? o.orderNumber ?? ''),
      status: String(o.status ?? ''),
      customerName: '—',
      items,
      totalAmount: Number.isFinite(total) ? total : 0,
      currency: 'TRY',
      createdAt: this.parseTrDateToIso(String(o.createDate ?? '')),
    };
  }

  private parseTrDateToIso(s: string): string {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(s);
    if (!m) {
      return new Date().toISOString();
    }
    const [, dd, mm, yyyy, hh, min] = m;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
    );
    return d.toISOString();
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
    const inner = `<sch:GetProductListRequest>
      ${this.buildAuthXml(apiKey, apiSecret)}
      <pagingData>
        <currentPage>${String(page)}</currentPage>
        <itemsPerPage>50</itemsPerPage>
      </pagingData>
    </sch:GetProductListRequest>`;
    const xml = await this.postSoap(N11_CATALOG_SERVICE_WSDL, this.wrapSoapBody(inner));
    const parsed = await this.parseXml(xml);
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
      return rec.pagingData as { totalCount?: string | number; pageSize?: string | number };
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

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!apiKey || !apiSecret) {
      throw new Error('N11 stok güncelleme: apiKey/apiSecret eksik');
    }
    for (const u of updates) {
      const inner = `<sch:UpdateStockByStockSellerCodeRequest>
      ${this.buildAuthXml(apiKey, apiSecret)}
      <stockSellerCode>${this.escapeXml(u.barcode)}</stockSellerCode>
      <quantity>${String(u.quantity)}</quantity>
    </sch:UpdateStockByStockSellerCodeRequest>`;
      const xml = await this.postSoap(N11_PRODUCT_WSDL, this.wrapSoapBody(inner));
      const parsed = await this.parseXml(xml);
      const fault = this.soapFaultMessage(parsed);
      if (fault) {
        throw new Error(`N11 stok (${u.barcode}): ${fault}`);
      }
      const st = this.findResultStatus(parsed);
      if (st?.status && st.status !== 'success') {
        throw new Error(`N11 stok (${u.barcode}): ${st.status}`);
      }
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;
    if (!apiKey || !apiSecret) {
      throw new Error('N11 fiyat güncelleme: apiKey/apiSecret eksik');
    }
    for (const u of updates) {
      const inner = `<sch:SaveProductRequest>
      ${this.buildAuthXml(apiKey, apiSecret)}
      <product xmlns="http://www.n11.com/ws/schemas">
        <productSellerCode>${this.escapeXml(u.barcode)}</productSellerCode>
        <price>${String(u.salePrice)}</price>
        <displayPrice>${String(u.listPrice)}</displayPrice>
        <currencyType>TL</currencyType>
      </product>
    </sch:SaveProductRequest>`;
      const xml = await this.postSoap(N11_CATALOG_SERVICE_WSDL, this.wrapSoapBody(inner));
      const parsed = await this.parseXml(xml);
      const fault = this.soapFaultMessage(parsed);
      if (fault) {
        throw new Error(`N11 fiyat (${u.barcode}): ${fault}`);
      }
      const st = this.findResultStatus(parsed);
      if (st?.status && st.status !== 'success') {
        throw new Error(`N11 fiyat (${u.barcode}): ${st.status}`);
      }
    }
  }
}
