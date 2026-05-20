import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

const MIKRO_BULUT_BASE = 'https://bulut.mikro.com.tr/api/v2';

@Injectable()
export class MikroBulutAdapter implements IErpAdapter {
  readonly erpType = 'MIKRO_BULUT';
  private readonly logger = new Logger(MikroBulutAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    const company = credentials.company?.trim() ?? credentials.companyId?.trim();
    if (!username || !password || !company) {
      throw new Error(
        'Mikro Bulut: username, password ve company zorunludur',
      );
    }
    const base = (credentials.baseUrl?.trim() || MIKRO_BULUT_BASE).replace(
      /\/+$/,
      '',
    );
    return axios.create({
      baseURL: base,
      auth: { username, password },
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Id': company,
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
        this.logger.warn('Mikro Bulut bağlantı testi başarısız', {
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
      this.logger.warn('Mikro Bulut ürün listesi alınamadı', {
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
