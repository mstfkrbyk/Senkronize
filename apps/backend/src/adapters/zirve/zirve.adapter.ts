import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { ZIRVE_API_PATH, ZIRVE_DEFAULT_PORT } from './zirve.constants';
import type { ZirveInvoiceCreateResponse, ZirveLoginResponse } from './zirve.types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function resolveZirveApiRoot(credentials: Record<string, string>): string {
  const raw = credentials.baseUrl?.trim();
  if (raw) {
    return normalizeBaseUrl(raw);
  }
  const host = credentials.host?.trim();
  if (!host) {
    return '';
  }
  const port = (credentials.port?.trim() || ZIRVE_DEFAULT_PORT).replace(/^:/, '');
  return normalizeBaseUrl(`http://${host}:${port}${ZIRVE_API_PATH}`);
}

function readToken(data: unknown): string | null {
  if (!isRecord(data)) {
    return null;
  }
  const t = data.token ?? data.accessToken ?? data.access_token;
  return typeof t === 'string' && t.length > 0 ? t : null;
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
    if (Array.isArray(data.rows)) {
      return data.rows;
    }
    const sk = data.StokKart ?? data.stokKart ?? data.StokKartlari;
    if (Array.isArray(sk)) {
      return sk;
    }
    if (isRecord(sk) && Array.isArray(sk.StokKart)) {
      return sk.StokKart;
    }
    if (isRecord(sk) && sk.StokKart !== undefined) {
      return [sk.StokKart];
    }
  }
  return [];
}

@Injectable()
export class ZirveAdapter implements IErpAdapter {
  readonly erpType = 'ZIRVE';
  private readonly logger = new Logger(ZirveAdapter.name);

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const explicit = credentials.token?.trim();
    if (explicit) {
      return explicit;
    }
    const baseUrl = resolveZirveApiRoot(credentials);
    const username = credentials.username;
    const password = credentials.password;
    if (!baseUrl || !username || !password) {
      throw new Error(
        'Zirve: baseUrl veya host (+isteğe bağlı port), username ve password (veya token) zorunludur',
      );
    }
    const data = await axiosWithRetry<ZirveLoginResponse>(
      {
        method: 'POST',
        url: `${baseUrl}/auth/login`,
        data: { username, password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 15_000,
      },
      { maxRetries: 2 },
    );
    const token = readToken(data as unknown);
    if (!token) {
      throw new Error('Zirve: oturum anahtarı alınamadı');
    }
    return token;
  }

  private async buildAuthHeaders(credentials: Record<string, string>): Promise<Record<string, string>> {
    const explicit = credentials.token?.trim();
    if (explicit) {
      return {
        Authorization: `Bearer ${explicit}`,
        'Content-Type': 'application/json',
      };
    }
    const username = credentials.username;
    const password = credentials.password;
    if (!username || !password) {
      throw new Error(
        'Zirve: baseUrl veya host (+isteğe bağlı port), username ve password (veya token) zorunludur',
      );
    }
    try {
      const token = await this.getToken(credentials);
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch {
      const basic = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
      return {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      };
    }
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const baseUrl = resolveZirveApiRoot(credentials);
      if (!baseUrl) {
        return false;
      }
      const headers = await this.buildAuthHeaders(credentials);
      const firmNo = (credentials.firmNo ?? credentials.firmno ?? '1').trim();
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${baseUrl}/stokkart`,
          params: { FirmaNo: firmNo },
          headers,
          timeout: 15_000,
        },
        { maxRetries: 1 },
      );
      return true;
    } catch (error) {
      this.logger.warn('Zirve bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const baseUrl = resolveZirveApiRoot(credentials);
      const headers = await this.buildAuthHeaders(credentials);
      const firmNo = (credentials.firmNo ?? credentials.firmno ?? '1').trim();
      let data: unknown;
      try {
        data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${baseUrl}/stokkart`,
            params: { FirmaNo: firmNo },
            headers,
            timeout: 30_000,
          },
          { maxRetries: 2 },
        );
      } catch {
        data = await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${baseUrl}/items`,
            params: { limit: 500, offset: 0 },
            headers,
            timeout: 30_000,
          },
          { maxRetries: 2 },
        );
      }
      const raw = normalizeItemsPayload(data);
      return raw.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const codeRaw =
          p.stokKodu ??
          p.StokKodu ??
          p.STOK_KODU ??
          p.code ??
          p.itemCode ??
          p.stockCode;
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
        const nameRaw =
          p.stokAdi ?? p.StokAdi ?? p.STOK_ADI ?? p.description ?? p.name ?? code;
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
      this.logger.warn('Zirve ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const baseUrl = resolveZirveApiRoot(credentials);
    const headers = await this.buildAuthHeaders(credentials);
    const today = new Date().toISOString().split('T')[0];
    const data = await axiosWithRetry<ZirveInvoiceCreateResponse>(
      {
        method: 'POST',
        url: `${baseUrl}/invoices`,
        data: {
          reference: invoice.orderRef,
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
        headers,
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
