import { Injectable, Logger } from '@nestjs/common';
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
import { parseMoney, throwSyncFailed } from '../stub-helpers';
import { CDISCOUNT_SOAP_URL } from './cdiscount.constants';
import type { CdiscountParsedOrder } from './cdiscount.types';

@Injectable()
export class CdiscountAdapter implements IMarketplaceAdapter {
  readonly platform = 'CDISCOUNT';
  private readonly logger = new Logger(CdiscountAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.CDISCOUNT ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private buildGetOrderListEnvelope(
    apiLogin: string,
    apiPassword: string,
    since?: Date,
  ): string {
    const sinceIso =
      since !== undefined
        ? since.toISOString().slice(0, 19)
        : new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19);
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:cdis="http://www.cdiscount.com">
  <soap:Header>
    <cdis:HeaderMessage>
      <cdis:Context>
        <cdis:CatalogID>1</cdis:CatalogID>
        <cdis:CustomerPoolID>1</cdis:CustomerPoolID>
        <cdis:SiteID>100</cdis:SiteID>
      </cdis:Context>
      <cdis:Security>
        <cdis:TokenId>${this.escapeXml(apiLogin)}</cdis:TokenId>
        <cdis:TokenId>${this.escapeXml(apiPassword)}</cdis:TokenId>
      </cdis:Security>
    </cdis:HeaderMessage>
  </soap:Header>
  <soap:Body>
    <cdis:GetOrderList>
      <cdis:OrderListRequest>
        <cdis:BeginModificationDate>${sinceIso}</cdis:BeginModificationDate>
      </cdis:OrderListRequest>
    </cdis:GetOrderList>
  </soap:Body>
</soap:Envelope>`;
  }

  private escapeXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private parseOrdersFromSoap(xml: string): CdiscountParsedOrder[] {
    const out: CdiscountParsedOrder[] = [];
    const re =
      /<(?:[^:>]+:)?OrderId>([^<]+)<\/(?:[^:>]+:)?OrderId>|<(?:[^:>]+:)?OrderNumber>([^<]+)<\/(?:[^:>]+:)?OrderNumber>/gi;
    let m: RegExpExecArray | null = re.exec(xml);
    while (m !== null) {
      const orderId = (m[1] ?? m[2] ?? '').trim();
      if (orderId.length > 0) {
        out.push({ orderId });
      }
      m = re.exec(xml);
    }
    return out;
  }

  private buildSubmitStockEnvelope(
    apiLogin: string,
    apiPassword: string,
    updates: StockUpdatePayload[],
  ): string {
    const items = updates
      .map(
        (u) =>
          `<cdis:OfferStock><cdis:SellerProductId>${this.escapeXml(
            u.barcode,
          )}</cdis:SellerProductId><cdis:Stock>${String(
            Math.max(0, Math.round(u.quantity)),
          )}</cdis:Stock></cdis:OfferStock>`,
      )
      .join('');
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:cdis="http://www.cdiscount.com">
  <soap:Header>
    <cdis:HeaderMessage>
      <cdis:Security>
        <cdis:TokenId>${this.escapeXml(apiLogin)}</cdis:TokenId>
        <cdis:TokenId>${this.escapeXml(apiPassword)}</cdis:TokenId>
      </cdis:Security>
    </cdis:HeaderMessage>
  </soap:Header>
  <soap:Body>
    <cdis:SubmitOfferStockPackage>${items}</cdis:SubmitOfferStockPackage>
  </soap:Body>
</soap:Envelope>`;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const apiLogin = credentials.apiLogin?.trim() ?? credentials.apiKey?.trim();
      const apiPassword = credentials.apiPassword?.trim() ?? '';
      if (!apiLogin || !apiPassword) {
        return false;
      }
      const body = this.buildGetOrderListEnvelope(apiLogin, apiPassword);
      await axiosWithRetry<string>(
        {
          method: 'POST',
          url: CDISCOUNT_SOAP_URL,
          timeout: 20_000,
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction: '"http://www.cdiscount.com/IMarketplaceAPIService/GetOrderList"',
          },
          data: body,
          responseType: 'text',
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Cdiscount bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const apiLogin = credentials.apiLogin?.trim() ?? credentials.apiKey?.trim();
      const apiPassword = credentials.apiPassword?.trim() ?? '';
      if (!apiLogin || !apiPassword) {
        throw new Error('Cdiscount: apiLogin ve apiPassword (veya apiKey+apiPassword) zorunludur');
      }
      const body = this.buildGetOrderListEnvelope(apiLogin, apiPassword, since);
      const xml = await withRateLimit('CDISCOUNT', this.rpm(), async () => {
        return await axiosWithRetry<string>(
          {
            method: 'POST',
            url: CDISCOUNT_SOAP_URL,
            timeout: 30_000,
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              SOAPAction: '"http://www.cdiscount.com/IMarketplaceAPIService/GetOrderList"',
            },
            data: body,
            responseType: 'text',
          },
          {},
        );
      });
      const parsed = this.parseOrdersFromSoap(xml);
      return parsed.map((p) => ({
        platformOrderId: p.orderId,
        status: p.status ?? 'NEW',
        customerName: '—',
        items: [],
        totalAmount: parseMoney(p.total),
        currency: typeof p.currency === 'string' ? p.currency : 'EUR',
        createdAt:
          typeof p.createdAt === 'string' && p.createdAt.length > 0
            ? new Date(p.createdAt).toISOString()
            : new Date().toISOString(),
      }));
    } catch (error) {
      throwSyncFailed('CDISCOUNT', 'getOrders', error);
    }
  }

  async getListings(
    _credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    void _credentials;
    this.logger.debug('Cdiscount getListings: SOAP katalog akışı henüz yok');
    return { items: [], total: 0, page, pageSize: 50 };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const apiLogin = credentials.apiLogin?.trim() ?? credentials.apiKey?.trim();
      const apiPassword = credentials.apiPassword?.trim() ?? '';
      if (!apiLogin || !apiPassword) {
        throw new Error('Cdiscount: apiLogin ve apiPassword zorunludur');
      }
      const body = this.buildSubmitStockEnvelope(apiLogin, apiPassword, updates);
      await withRateLimit('CDISCOUNT', this.rpm(), async () => {
        await axiosWithRetry<string>(
          {
            method: 'POST',
            url: CDISCOUNT_SOAP_URL,
            timeout: 30_000,
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              SOAPAction:
                '"http://www.cdiscount.com/IMarketplaceAPIService/SubmitOfferStockPackage"',
            },
            data: body,
            responseType: 'text',
          },
          {},
        );
      });
    } catch (error) {
      throwSyncFailed('CDISCOUNT', 'updateStock', error);
    }
  }

  async updatePrice(
    _credentials: Record<string, string>,
    _updates: PriceUpdatePayload[],
  ): Promise<void> {
    void _credentials;
    void _updates;
    this.logger.warn(
      'Cdiscount: SOAP fiyat güncelleme bu sürümde desteklenmiyor (stok ve sipariş kullanın)',
    );
  }
}
