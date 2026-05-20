import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { ETA_API_PREFIX } from './eta.constants';
import type { EtaInvoiceCreateResponse, EtaTokenResponse } from './eta.types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function usesEtaV8(credentials: Record<string, string>): boolean {
  if (credentials.etaVersion === 'v8') {
    return true;
  }
  const b = credentials.baseUrl?.toLowerCase() ?? '';
  return b.includes('etav8');
}

function resolveEtaV8Root(credentials: Record<string, string>): string {
  const raw = credentials.baseUrl?.trim();
  if (raw) {
    return normalizeBaseUrl(raw);
  }
  const host = credentials.host?.trim();
  if (!host) {
    return '';
  }
  const port = credentials.port?.trim();
  const proto = credentials.useHttps === 'true' ? 'https' : 'http';
  const authority =
    port && port.length > 0 && port !== '80' && port !== '443' ? `${host}:${port}` : host;
  return normalizeBaseUrl(`${proto}://${authority}/etav8api`);
}

function resolveEtaBaseUrl(credentials: Record<string, string>): string {
  const raw = credentials.baseUrl?.trim();
  if (raw) {
    return normalizeBaseUrl(raw);
  }
  const host = credentials.host?.trim();
  if (!host) {
    return '';
  }
  const port = (credentials.port?.trim() || '80').replace(/^:/, '');
  return normalizeBaseUrl(`http://${host}:${port}/eta/api`);
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
  const t = data.token ?? data.access_token ?? data.apiToken;
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
    if (Array.isArray(data.Data)) {
      return data.Data;
    }
  }
  return [];
}

@Injectable()
export class EtaAdapter implements IErpAdapter {
  readonly erpType = 'ETA';
  private readonly logger = new Logger(EtaAdapter.name);

  private async getEtaLegacyToken(credentials: Record<string, string>): Promise<string> {
    const baseUrl = resolveEtaBaseUrl(credentials);
    const username = credentials.username;
    const password = credentials.password;
    if (!baseUrl || !username || !password) {
      throw new Error('ETA: baseUrl veya host+port, username ve password zorunludur');
    }
    const data = await axiosWithRetry<EtaTokenResponse>(
      {
        method: 'POST',
        url: `${baseUrl}${ETA_API_PREFIX}/token`,
        data: { username, password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 15_000,
      },
      { maxRetries: 2 },
    );
    const token = readToken(data as unknown);
    if (!token) {
      throw new Error('ETA: token alınamadı');
    }
    return token;
  }

  private async getEtaV8Token(credentials: Record<string, string>): Promise<string> {
    const staticTok = (credentials.apiToken ?? credentials.token ?? '').trim();
    if (staticTok) {
      return staticTok;
    }
    const baseUrl = resolveEtaV8Root(credentials);
    const username = credentials.username;
    const password = credentials.password;
    if (!baseUrl || !username || !password) {
      throw new Error(
        'ETA V8: baseUrl veya host, apiToken (veya token) ya da username+password zorunludur',
      );
    }
    const data = await axiosWithRetry<EtaTokenResponse>(
      {
        method: 'POST',
        url: `${baseUrl}/api/token`,
        data: { username, password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 15_000,
      },
      { maxRetries: 2 },
    );
    const token = readToken(data as unknown);
    if (!token) {
      throw new Error('ETA V8: token alınamadı');
    }
    return token;
  }

  private async resolveAccessToken(credentials: Record<string, string>): Promise<string> {
    if (usesEtaV8(credentials)) {
      return this.getEtaV8Token(credentials);
    }
    return this.getEtaLegacyToken(credentials);
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const token = await this.resolveAccessToken(credentials);
      if (usesEtaV8(credentials)) {
        const root = resolveEtaV8Root(credentials);
        if (!root) {
          return { success: false };
        }
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${root}/api/products`,
            params: { token, page: 1 },
            timeout: 15_000,
          },
          { maxRetries: 1 },
        );
        return { success: true };
      }
      const root = resolveEtaBaseUrl(credentials);
      if (!root) {
        return { success: false };
      }
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${root}/items`,
          params: { limit: 1, offset: 0 },
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15_000,
        },
        { maxRetries: 1 },
      );
      return { success: true };
    } catch (error) {
      this.logger.warn('ETA bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const v8 = usesEtaV8(credentials);
      const baseUrl = v8 ? resolveEtaV8Root(credentials) : resolveEtaBaseUrl(credentials);
      const token = await this.resolveAccessToken(credentials);
      if (!baseUrl) {
        throw new Error('ETA: baseUrl veya host zorunludur');
      }
      if (v8) {
        const merged: unknown[] = [];
        for (let page = 1; page < 500; page += 1) {
          const data = await axiosWithRetry<unknown>(
            {
              method: 'GET',
              url: `${baseUrl}/api/products`,
              params: { token, page },
              timeout: 30_000,
            },
            { maxRetries: 2 },
          );
          const raw = normalizeItemsPayload(data);
          if (raw.length === 0) {
            break;
          }
          merged.push(...raw);
          if (raw.length < 100) {
            break;
          }
        }
        return merged.map((row, i) => {
          const p = isRecord(row) ? row : {};
          const codeRaw = p.code ?? p.itemCode ?? p.stockCode ?? p.productCode;
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
          const stockRaw = p.stock ?? p.stockQuantity ?? p.quantityOnHand ?? 0;
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
      }
      const data = await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${baseUrl}/items`,
          params: { limit: 500, offset: 0 },
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        },
        { maxRetries: 2 },
      );
      const raw = normalizeItemsPayload(data);
      return raw.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const codeRaw = p.code ?? p.itemCode ?? p.stockCode;
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
        const stockRaw = p.stock ?? p.stockQuantity ?? p.quantityOnHand ?? 0;
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
      this.logger.warn('ETA ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const v8 = usesEtaV8(credentials);
    const baseUrl = v8 ? resolveEtaV8Root(credentials) : resolveEtaBaseUrl(credentials);
    const token = await this.resolveAccessToken(credentials);
    const today = new Date().toISOString().split('T')[0];
    const url = v8 ? `${baseUrl}/api/invoices` : `${baseUrl}/invoices`;
    const data = await axiosWithRetry<EtaInvoiceCreateResponse>(
      {
        method: 'POST',
        url,
        params: v8 ? { token } : undefined,
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
        headers: v8
          ? { 'Content-Type': 'application/json' }
          : {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
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
