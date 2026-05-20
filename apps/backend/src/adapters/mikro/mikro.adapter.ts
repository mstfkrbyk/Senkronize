import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { MIKRO_API_PATH } from './mikro.constants';
import type {
  MikroInvoiceCreateResponse,
  MikroLoginResponse,
  MikroProductsResponse,
} from './mikro.types';

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

@Injectable()
export class MikroAdapter implements IErpAdapter {
  readonly erpType = 'MIKRO';
  private readonly logger = new Logger(MikroAdapter.name);

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const baseUrl = normalizeBaseUrl(credentials.baseUrl ?? '');
    const username = credentials.username;
    const password = credentials.password;
    const dbName = credentials.dbName;
    if (!baseUrl || !username || !password || !dbName) {
      throw new Error('Mikro: baseUrl, username, password ve dbName zorunludur');
    }
    const { data } = await axios.post<MikroLoginResponse>(
      `${baseUrl}${MIKRO_API_PATH}/auth/login`,
      { username, password, databaseName: dbName },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    if (!data.accessToken) {
      throw new Error('Mikro: accessToken alınamadı');
    }
    return axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${data.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      await this.getClient(credentials);
      return { success: true };
    } catch (error) {
      this.logger.warn('Mikro bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const client = await this.getClient(credentials);
      const { data } = await client.get<MikroProductsResponse>(
        `${MIKRO_API_PATH}/products`,
        { params: { limit: 500, offset: 0 } },
      );
      const raw = data.products ?? data.items ?? [];
      return raw.map((p, i) => {
        const code = (p.code ?? '').trim() || `row-${i}`;
        return {
          erpProductId: code,
          barcode: (p.barcode ?? p.code ?? code).trim(),
          name: (p.name ?? code).trim() || code,
          stockQuantity: Math.max(0, Math.round(Number(p.stockQty ?? 0))),
          purchasePrice: p.purchasePrice,
        };
      });
    } catch (error) {
      this.logger.warn('Mikro ürün listesi alınamadı (stub/yol uyumsuz olabilir)', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = await this.getClient(credentials);
    const today = new Date().toISOString().split('T')[0];
    const body = {
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
    };
    const { data } = await client.post<MikroInvoiceCreateResponse>(
      `${MIKRO_API_PATH}/invoices`,
      body,
    );
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
