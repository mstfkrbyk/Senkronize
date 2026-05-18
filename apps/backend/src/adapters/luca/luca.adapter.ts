import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { LUCA_BASE_URL } from './luca.constants';
import type { LucaInvoiceCreateResponse, LucaProductsResponse } from './luca.types';

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
export class LucaAdapter implements IErpAdapter {
  readonly erpType = 'LUCA';
  private readonly logger = new Logger(LucaAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey;
    const companyId = credentials.companyId;
    if (!apiKey || !companyId) {
      throw new Error('Luca: apiKey ve companyId zorunludur');
    }
    return axios.create({
      baseURL: LUCA_BASE_URL,
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        'X-Company-Id': companyId,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = this.getClient(credentials);
      await client.get('/products', { params: { limit: 1 } });
      return true;
    } catch (error) {
      this.logger.warn('Luca bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const client = this.getClient(credentials);
      const { data } = await client.get<LucaProductsResponse>('/products', {
        params: { limit: 500 },
      });
      const raw = data.data ?? data.products ?? data.items ?? [];
      return raw.map((p, i) => {
        const id = (p.id ?? p.code ?? p.sku ?? `row-${i}`).toString().trim();
        const name = (p.name ?? p.title ?? id).trim() || id;
        const qty = p.stockQuantity ?? p.quantity ?? 0;
        return {
          erpProductId: id,
          barcode: (p.barcode ?? p.sku ?? p.code ?? id).trim(),
          name,
          stockQuantity: Math.max(0, Math.round(Number(qty))),
          purchasePrice: p.purchasePrice,
        };
      });
    } catch (error) {
      this.logger.warn('Luca ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = this.getClient(credentials);
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
    const { data } = await client.post<LucaInvoiceCreateResponse>('/invoices', body);
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
