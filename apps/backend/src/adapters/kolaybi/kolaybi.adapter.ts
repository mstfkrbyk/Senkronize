import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { KOLAYBI_BASE_URL } from './kolaybi.constants';
import type {
  KolaybiInvoiceCreateResponse,
  KolaybiProductsEnvelope,
  KolaybiProductRow,
} from './kolaybi.types';

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

function normalizeProductsPayload(data: unknown): KolaybiProductRow[] {
  if (Array.isArray(data)) {
    return data as KolaybiProductRow[];
  }
  if (isRecord(data)) {
    const env = data as KolaybiProductsEnvelope;
    if (Array.isArray(env.data)) {
      return env.data;
    }
    if (Array.isArray(env.items)) {
      return env.items;
    }
    if (Array.isArray(data.results)) {
      return data.results as KolaybiProductRow[];
    }
  }
  return [];
}

@Injectable()
export class KolaybiAdapter implements IErpAdapter {
  readonly erpType = 'KOLAYBI';
  private readonly logger = new Logger(KolaybiAdapter.name);

  private headers(apiKey: string): Record<string, string> {
    return {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      return false;
    }
    try {
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${KOLAYBI_BASE_URL}/products`,
          params: { limit: 1 },
          headers: this.headers(apiKey),
          timeout: 15_000,
        },
        { maxRetries: 2, retryOn: [429, 500, 502, 503, 504] },
      );
      return true;
    } catch (error) {
      this.logger.warn('Kolaybi bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error('Kolaybi: apiKey zorunludur');
    }
    try {
      const data = await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${KOLAYBI_BASE_URL}/products`,
          params: { limit: 500, offset: 0 },
          headers: this.headers(apiKey),
          timeout: 30_000,
        },
        { maxRetries: 2 },
      );
      const rows = normalizeProductsPayload(data);
      return rows.map((p, i) => {
        const code = (p.code ?? p.sku ?? p.id ?? `row-${i}`).toString().trim() || `row-${i}`;
        const name = (p.name ?? p.title ?? code).toString().trim() || code;
        const stock = p.stockQuantity ?? p.quantity ?? 0;
        const purchasePrice =
          p.purchasePrice !== undefined && Number.isFinite(Number(p.purchasePrice))
            ? Number(p.purchasePrice)
            : undefined;
        return {
          erpProductId: code,
          barcode: (p.sku ?? p.code ?? code).toString().trim(),
          name,
          stockQuantity: Math.max(0, Math.round(Number(stock))),
          ...(purchasePrice !== undefined ? { purchasePrice } : {}),
        };
      });
    } catch (error) {
      this.logger.warn('Kolaybi ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error('Kolaybi: apiKey zorunludur');
    }
    const today = new Date().toISOString().split('T')[0];
    const data = await axiosWithRetry<KolaybiInvoiceCreateResponse>(
      {
        method: 'POST',
        url: `${KOLAYBI_BASE_URL}/invoices`,
        data: {
          externalReference: invoice.orderRef,
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
        headers: this.headers(apiKey),
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
