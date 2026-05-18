import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import axios from 'axios';
import type {
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { TICIMAX_SERVICE_PATH, TICIMAX_SOAP_XMLNS } from './ticimax.constants';

@Injectable()
export class TicimaxAdapter implements IMarketplaceAdapter, IErpAdapter {
  readonly platform = 'TICIMAX';
  readonly erpType = 'TICIMAX';
  private readonly logger = new Logger(TicimaxAdapter.name);

  private normalizeSiteUrl(siteUrl: string): string {
    return siteUrl.trim().replace(/\/+$/, '');
  }

  private buildSoapEnvelope(method: string, body: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method} xmlns="${TICIMAX_SOAP_XMLNS}">
      ${body}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    const siteUrl = credentials.siteUrl?.trim();
    const username = credentials.username?.trim();
    const password = credentials.password ?? '';
    if (!siteUrl || !username) {
      return false;
    }
    const url = `${this.normalizeSiteUrl(siteUrl)}${TICIMAX_SERVICE_PATH}`;
    const body = this.buildSoapEnvelope(
      'SelectUyelik',
      `<UyeKodu>${this.escapeXml(username)}</UyeKodu>
       <Sifre>${this.escapeXml(password)}</Sifre>`,
    );
    try {
      const { status } = await axios.post(url, body, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `${TICIMAX_SOAP_XMLNS}SelectUyelik`,
        },
        timeout: 20_000,
      });
      return status === 200;
    } catch (error) {
      this.logger.warn('Ticimax bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<MarketplaceOrder[]> {
    this.logger.log(
      'Ticimax sipariş çekme henüz tanımlı değil; SOAP metodu netleşince eklenecek.',
    );
    return [];
  }

  async getListings(
    _credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    this.logger.log(
      'Ticimax ürün listesi henüz tanımlı değil; SOAP metodu netleşince eklenecek.',
    );
    return {
      items: [],
      total: 0,
      page,
      pageSize: 50,
    };
  }

  async updateStock(
    _credentials: Record<string, string>,
    _updates: StockUpdatePayload[],
  ): Promise<void> {
    this.logger.log('Ticimax stok güncelleme henüz tanımlı değil.');
  }

  async updatePrice(
    _credentials: Record<string, string>,
    _updates: PriceUpdatePayload[],
  ): Promise<void> {
    this.logger.log('Ticimax fiyat güncelleme henüz tanımlı değil.');
  }

  async getProducts(_credentials: Record<string, string>): Promise<ErpProduct[]> {
    return [];
  }

  async createInvoice(
    _credentials: Record<string, string>,
    _invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    throw new NotImplementedException('Ticimax fatura oluşturma henüz desteklenmiyor');
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}
