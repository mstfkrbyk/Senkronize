import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosResponse } from 'axios';

import { axiosWithRetry } from '../../common/utils/http-retry';
import type { SapB1InvoiceCreateResponse, SapB1ItemsEnvelope } from './sapb1.types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function joinSetCookieHeader(setCookie: unknown): string {
  if (typeof setCookie === 'string') {
    return setCookie.split(';')[0];
  }
  if (Array.isArray(setCookie)) {
    return setCookie.map((c) => (typeof c === 'string' ? c.split(';')[0] : '')).filter(Boolean).join('; ');
  }
  return '';
}

interface SapB1Session {
  cookieHeader: string;
  expiresAt: number;
}

@Injectable()
export class SapB1Adapter implements IErpAdapter {
  readonly erpType = 'SAP_B1';
  private readonly logger = new Logger(SapB1Adapter.name);
  private readonly sessionCache = new Map<string, SapB1Session>();

  private sessionKey(credentials: Record<string, string>): string {
    const base = normalizeBaseUrl(credentials.baseUrl ?? '');
    return `${base}\0${credentials.companyDB ?? ''}\0${credentials.username ?? ''}`;
  }

  private async ensureSession(credentials: Record<string, string>): Promise<string> {
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    const companyDB = credentials.companyDB;
    const username = credentials.username;
    const password = credentials.password;
    if (!baseUrl || !companyDB || !username || !password) {
      throw new Error('SAP B1: baseUrl, companyDB, username ve password zorunludur');
    }
    const key = this.sessionKey(credentials);
    const now = Date.now();
    const cached = this.sessionCache.get(key);
    if (cached && cached.expiresAt > now + 5000) {
      return cached.cookieHeader;
    }
    const res: AxiosResponse<unknown> = await axios.post(
      `${baseUrl}/Login`,
      {
        CompanyDB: companyDB,
        UserName: username,
        Password: password,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20_000,
        validateStatus: (s) => s >= 200 && s < 300,
      },
    );
    const cookieHeader = joinSetCookieHeader(res.headers['set-cookie']);
    if (!cookieHeader.includes('B1SESSION')) {
      this.logger.warn('SAP B1: Login yanıtında B1SESSION çerezi bulunamadı');
    }
    if (cookieHeader.length === 0) {
      throw new Error('SAP B1: oturum çerezi alınamadı');
    }
    this.sessionCache.set(key, {
      cookieHeader,
      expiresAt: now + 25 * 60 * 1000,
    });
    return cookieHeader;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const cookie = await this.ensureSession(credentials);
      const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
      await axiosWithRetry<SapB1ItemsEnvelope>(
        {
          method: 'GET',
          url: `${baseUrl}/Items`,
          params: { $top: 1 },
          headers: {
            Cookie: cookie,
            'Content-Type': 'application/json',
          },
          timeout: 15_000,
        },
        { maxRetries: 2 },
      );
      return true;
    } catch (error) {
      this.logger.warn('SAP B1 bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const cookie = await this.ensureSession(credentials);
      const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
      const data = await axiosWithRetry<SapB1ItemsEnvelope>(
        {
          method: 'GET',
          url: `${baseUrl}/Items`,
          params: { $top: 500 },
          headers: {
            Cookie: cookie,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        },
        { maxRetries: 2 },
      );
      const raw = Array.isArray(data.value) ? data.value : [];
      return raw.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const codeRaw = p.ItemCode ?? p.itemCode;
        const code =
          typeof codeRaw === 'string'
            ? codeRaw.trim()
            : typeof codeRaw === 'number' && Number.isFinite(codeRaw)
              ? String(codeRaw)
              : `row-${i}`;
        const nameRaw = p.ItemName ?? p.itemName ?? code;
        const name =
          typeof nameRaw === 'string' ? nameRaw.trim() || code : String(nameRaw);
        const stockRows = p.ItemWarehouseInfoCollection;
        let stock = 0;
        if (Array.isArray(stockRows)) {
          for (const w of stockRows) {
            if (isRecord(w)) {
              const q = w.InStock;
              if (typeof q === 'number' && Number.isFinite(q)) {
                stock += q;
              }
            }
          }
        }
        const qtyRaw = p.QuantityOnStock ?? p.OnHand;
        if (stock === 0 && typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)) {
          stock = qtyRaw;
        }
        const purchaseRaw = p.PurchasePrice ?? p.AvgStdPrice;
        const purchasePrice =
          purchaseRaw !== undefined && purchaseRaw !== null
            ? Number(purchaseRaw)
            : undefined;
        return {
          erpProductId: code,
          barcode: code,
          name,
          stockQuantity: Math.max(0, Math.round(stock)),
          ...(Number.isFinite(purchasePrice) ? { purchasePrice } : {}),
        };
      });
    } catch (error) {
      this.logger.warn('SAP B1 ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const cookie = await this.ensureSession(credentials);
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    const today = new Date().toISOString().split('T')[0];
    const data = await axiosWithRetry<SapB1InvoiceCreateResponse>(
      {
        method: 'POST',
        url: `${baseUrl}/Invoices`,
        data: {
          CardCode: invoice.orderRef.length > 0 ? invoice.orderRef : 'C00001',
          DocDate: today,
          DocDueDate: today,
          DocumentLines: invoice.lines.map((l) => ({
            ItemDescription: l.description,
            Quantity: l.quantity,
            UnitPrice: l.unitPrice,
            TaxPercentagePerRow: l.taxRate,
            LineTotal: l.total,
          })),
        },
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
    const docEntry =
      typeof data.DocEntry === 'number' && Number.isFinite(data.DocEntry)
        ? String(data.DocEntry)
        : 'unknown';
    const docNum =
      typeof data.DocNum === 'number' && Number.isFinite(data.DocNum)
        ? String(data.DocNum)
        : docEntry;
    return {
      erpInvoiceId: docEntry,
      orderRef: invoice.orderRef,
      invoiceNumber: docNum,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      issuedAt: today,
      lines: invoice.lines,
    };
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}
