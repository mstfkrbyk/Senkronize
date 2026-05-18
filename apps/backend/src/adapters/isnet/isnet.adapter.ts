import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';

import { axiosWithRetry } from '../../common/utils/http-retry';
import type { IsnetInvoiceCreateResponse } from './isnet.types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickInvoiceMeta(data: unknown): { id: string; number: string } {
  if (!isRecord(data)) {
    return { id: 'unknown', number: 'unknown' };
  }
  const num =
    (typeof data.invoiceNumber === 'string' && data.invoiceNumber) ||
    (typeof data.number === 'string' && data.number) ||
    '';
  const id =
    (typeof data.id === 'string' && data.id) ||
    (typeof data.invoiceId === 'string' && data.invoiceId) ||
    num ||
    'unknown';
  return { id, number: num || id };
}

function normalizeItemsPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (isRecord(data)) {
    if (Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data.data)) {
      return data.data;
    }
    if (Array.isArray(data.products)) {
      return data.products;
    }
  }
  return [];
}

@Injectable()
export class IsnetAdapter implements IErpAdapter {
  readonly erpType = 'ISNET';
  private readonly logger = new Logger(IsnetAdapter.name);

  private authHeaders(credentials: Record<string, string>): Record<string, string> {
    const apiKey = credentials.apiKey;
    const username = credentials.username;
    const password = credentials.password;
    if (apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    }
    if (username && password) {
      const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
      return {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      };
    }
    throw new Error('İşnet: apiKey veya username+password zorunludur');
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    if (!baseUrl) {
      return false;
    }
    try {
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${baseUrl}/health`,
          headers: this.authHeaders(credentials),
          timeout: 10_000,
        },
        { maxRetries: 1, retryOn: [429, 500, 502, 503, 504] },
      );
      return true;
    } catch {
      try {
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${baseUrl}/products`,
            params: { limit: 1 },
            headers: this.authHeaders(credentials),
            timeout: 10_000,
          },
          { maxRetries: 1, retryOn: [429, 500, 502, 503, 504] },
        );
        return true;
      } catch (error) {
        this.logger.warn('İşnet bağlantı testi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        return false;
      }
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    if (!baseUrl) {
      throw new Error('İşnet: baseUrl zorunludur');
    }
    try {
      const data = await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${baseUrl}/products`,
          params: { limit: 500, offset: 0 },
          headers: this.authHeaders(credentials),
          timeout: 30_000,
        },
        { maxRetries: 2 },
      );
      const raw = normalizeItemsPayload(data);
      return raw.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const codeRaw = p.code ?? p.sku ?? p.productCode;
        const code =
          typeof codeRaw === 'string'
            ? codeRaw.trim()
            : typeof codeRaw === 'number' && Number.isFinite(codeRaw)
              ? String(codeRaw)
              : `row-${i}`;
        const barcodeRaw = p.barcode ?? p.code ?? code;
        const barcode =
          typeof barcodeRaw === 'string'
            ? barcodeRaw.trim()
            : typeof barcodeRaw === 'number' && Number.isFinite(barcodeRaw)
              ? String(barcodeRaw)
              : code;
        const nameRaw = p.name ?? p.title ?? code;
        const name =
          typeof nameRaw === 'string' ? nameRaw.trim() || code : String(nameRaw);
        const stockRaw = p.stock ?? p.stockQuantity ?? 0;
        const purchaseRaw = p.purchasePrice ?? p.price;
        const purchasePrice =
          purchaseRaw !== undefined && purchaseRaw !== null
            ? Number(purchaseRaw)
            : undefined;
        return {
          erpProductId: code,
          barcode,
          name,
          stockQuantity: Math.max(0, Math.round(Number(stockRaw))),
          ...(Number.isFinite(purchasePrice) ? { purchasePrice } : {}),
        };
      });
    } catch (error) {
      this.logger.warn('İşnet ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    if (!baseUrl) {
      throw new Error('İşnet: baseUrl zorunludur');
    }
    const today = new Date().toISOString().split('T')[0];
    const data = await axiosWithRetry<IsnetInvoiceCreateResponse>(
      {
        method: 'POST',
        url: `${baseUrl}/orders/import`,
        data: {
          externalOrderRef: invoice.orderRef,
          currency: invoice.currency,
          totalAmount: invoice.totalAmount,
          issueDate: today,
          lines: invoice.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            lineTotal: l.total,
          })),
        },
        headers: this.authHeaders(credentials),
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
    const meta = pickInvoiceMeta(data as unknown);
    return {
      erpInvoiceId: meta.id,
      orderRef: invoice.orderRef,
      invoiceNumber: meta.number,
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
