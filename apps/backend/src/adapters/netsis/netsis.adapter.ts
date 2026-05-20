import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { NETSIS_API_PATH } from './netsis.constants';

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
    (typeof data.invoiceNo === 'string' && data.invoiceNo) ||
    '';
  const id =
    (typeof data.id === 'string' && data.id) ||
    (typeof data.invoiceId === 'string' && data.invoiceId) ||
    num ||
    'unknown';
  return { id, number: num || id };
}

function readToken(data: unknown): string | null {
  if (!isRecord(data)) {
    return null;
  }
  const t = data.token ?? data.access_token;
  return typeof t === 'string' && t.length > 0 ? t : null;
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
  }
  return [];
}

@Injectable()
export class NetsisAdapter implements IErpAdapter {
  readonly erpType = 'NETSIS';
  private readonly logger = new Logger(NetsisAdapter.name);

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    const username = credentials.username;
    const password = credentials.password;
    const database = credentials.databaseAlias;
    if (!baseUrl || !username || !password || !database) {
      throw new Error('Netsis: baseUrl, username, password ve databaseAlias zorunludur');
    }
    const { data } = await axios.post<unknown>(
      `${baseUrl}${NETSIS_API_PATH}/auth/token`,
      { username, password, database },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10_000 },
    );
    const token = readToken(data);
    if (!token) {
      throw new Error('Netsis: token alınamadı');
    }
    return token;
  }

  private getClient(baseUrl: string, token: string): AxiosInstance {
    return axios.create({
      baseURL: `${normalizeBaseUrl(baseUrl)}${NETSIS_API_PATH}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      await this.getToken(credentials);
      return { success: true };
    } catch (error) {
      this.logger.warn('Netsis bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const token = await this.getToken(credentials);
      const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
      const { data } = await this.getClient(baseUrl, token).get<unknown>('/items', {
        params: { limit: 500, offset: 0 },
      });
      const raw = normalizeItemsPayload(data);
      return raw.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const codeRaw = p.code ?? p.itemCode;
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
        const nameRaw = p.description ?? p.name ?? code;
        const name =
          typeof nameRaw === 'string' ? nameRaw.trim() || code : String(nameRaw);
        const stockRaw = p.stock ?? p.stockQuantity ?? 0;
        const purchaseRaw = p.purchasePrice ?? p.buyPrice ?? p.cost;
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
      this.logger.warn('Netsis ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const token = await this.getToken(credentials);
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    const today = new Date().toISOString().split('T')[0];
    const { data } = await this.getClient(baseUrl, token).post<unknown>('/invoices', {
      invoiceDate: today,
      customerCode: invoice.orderRef.length > 0 ? invoice.orderRef : 'PERAKENDE',
      items: invoice.lines.map((item) => ({
        itemCode: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
    const meta = pickInvoiceMeta(data);
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
