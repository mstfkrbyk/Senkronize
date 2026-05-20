import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

const BIZIM_MUHASEBE_BASE = 'https://api.bizimmuhasebe.com/v2';

@Injectable()
export class BizimMuhasebeAdapter implements IErpAdapter {
  readonly erpType = 'BIZIM_MUHASEBE';
  private readonly logger = new Logger(BizimMuhasebeAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      throw new Error('Bizim Muhasebe: apiKey zorunludur');
    }
    const base = (credentials.baseUrl?.trim() || BIZIM_MUHASEBE_BASE).replace(
      /\/+$/,
      '',
    );
    return axios.create({
      baseURL: base,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = this.getClient(credentials);
      await client.get('/me', { timeout: 12_000 });
      return { success: true };
    } catch {
      try {
        const client = this.getClient(credentials);
        await client.get('/products', { params: { limit: 1 }, timeout: 12_000 });
        return { success: true };
      } catch (error) {
        this.logger.warn('Bizim Muhasebe bağlantı testi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        return { success: false };
      }
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const client = this.getClient(credentials);
      const { data } = await client.get<unknown>('/products', {
        params: { limit: 500 },
      });
      const raw = Array.isArray(data)
        ? data
        : typeof data === 'object' &&
            data !== null &&
            'items' in data &&
            Array.isArray((data as { items: unknown[] }).items)
          ? (data as { items: unknown[] }).items
          : [];
      return raw.map((row: unknown, i: number) => {
        const p =
          typeof row === 'object' && row !== null
            ? (row as Record<string, unknown>)
            : {};
        const code = String(p.id ?? p.code ?? `row-${i}`);
        return {
          erpProductId: code,
          barcode: String(p.barcode ?? p.sku ?? code),
          name: String(p.name ?? code),
          stockQuantity: Math.max(
            0,
            Math.round(Number(p.stock ?? p.quantity ?? 0)),
          ),
        };
      });
    } catch (error) {
      this.logger.warn('Bizim Muhasebe ürün listesi alınamadı', {
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
    const { data } = await client.post<{ id?: string; number?: string }>(
      '/invoices',
      {
        reference: invoice.orderRef,
        currency: invoice.currency,
        totalAmount: invoice.totalAmount,
        lines: invoice.lines,
      },
    );
    const id = String(data.id ?? 'unknown');
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: String(data.number ?? id),
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
