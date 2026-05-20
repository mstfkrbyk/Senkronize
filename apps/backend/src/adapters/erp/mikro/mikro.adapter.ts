import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';
import type { AxiosInstance } from 'axios';

import { ErpRestHttpService, rowsFromPayload } from '../erp-rest-http';
import { isRecord } from '../erp-adapter.utils';
import type { ErpStockCapableAdapter } from '../../../jobs/erp-sync.helpers';

import { MIKRO_PLATFORM_KEY, MIKRO_REST_API_PATH } from './mikro.constants';
import type { MikroSatisFisResponse, MikroStokRow } from './mikro.types';

type ErpInvoiceInput = Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'> & {
  customerName?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
    sku?: string;
  }>;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeCariKod(orderRef: string): string {
  const cleaned = orderRef.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
  return cleaned.length > 0 ? `SNK-${cleaned}` : `SNK-${Date.now()}`;
}

function pickStokKod(row: MikroStokRow): string {
  return (row.stokKod ?? row.stokKodu ?? row.code ?? '').trim();
}

function pickInvoiceMeta(data: unknown): { id: string; number: string } {
  if (!isRecord(data)) {
    return { id: 'unknown', number: 'unknown' };
  }
  const row = data as MikroSatisFisResponse & Record<string, unknown>;
  const num =
    (typeof row.fisNo === 'string' && row.fisNo) ||
    (typeof row.invoiceNumber === 'string' && row.invoiceNumber) ||
    (typeof row.number === 'string' && row.number) ||
    '';
  const id =
    (typeof row.id === 'string' && row.id) ||
    num ||
    'unknown';
  return { id, number: num || id };
}

@Injectable()
export class MikroErpAdapter implements IErpAdapter, ErpStockCapableAdapter {
  readonly erpType = MIKRO_PLATFORM_KEY;
  private readonly logger = new Logger(MikroErpAdapter.name);

  constructor(private readonly http: ErpRestHttpService) {}

  private client(credentials: Record<string, string>): AxiosInstance {
    const baseURL = this.http.buildBaseUrl(credentials, MIKRO_REST_API_PATH);
    return this.http.createClient(baseURL, this.http.resolveMikroAuth(credentials));
  }

  private async apiGet<T>(
    credentials: Record<string, string>,
    organizationId: string,
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const client = this.client(credentials);
    return this.http.request<T>(MIKRO_PLATFORM_KEY, organizationId, {
      method: 'GET',
      url: path,
      baseURL: client.defaults.baseURL,
      headers: client.defaults.headers as Record<string, string>,
      params,
      timeout: client.defaults.timeout as number,
    });
  }

  private async apiWrite<T>(
    credentials: Record<string, string>,
    organizationId: string,
    method: 'POST' | 'PUT',
    path: string,
    data?: unknown,
  ): Promise<T> {
    const client = this.client(credentials);
    return this.http.request<T>(MIKRO_PLATFORM_KEY, organizationId, {
      method,
      url: path,
      baseURL: client.defaults.baseURL,
      headers: client.defaults.headers as Record<string, string>,
      data,
      timeout: client.defaults.timeout as number,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const data = await this.apiGet<unknown>(credentials, 'connection-test', '/stok/liste', {
        sayfa: 1,
        sayfaBoyut: 1,
      });
      const rows = rowsFromPayload(data);
      return {
        success: true,
        companyName: credentials.companyName,
        version: 'rest',
        productCount: rows.length,
      };
    } catch (error) {
      this.logger.warn('Mikro ERP bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const orgId = credentials.organizationId ?? 'global';
    const out: ErpProduct[] = [];
    let sayfa = 1;
    const sayfaBoyut = 100;

    for (let i = 0; i < 200; i += 1) {
      const data = await this.apiGet<unknown>(credentials, orgId, '/stok/liste', {
        sayfa,
        sayfaBoyut,
      });
      const rows = rowsFromPayload(data) as MikroStokRow[];
      if (rows.length === 0) {
        break;
      }
      for (const row of rows) {
        const code = pickStokKod(row);
        if (!code) {
          continue;
        }
        let stockQty = 0;
        try {
          const qtyData = await this.apiGet<unknown>(
            credentials,
            orgId,
            `/stok/${encodeURIComponent(code)}/miktar`,
          );
          if (isRecord(qtyData)) {
            stockQty = Math.max(
              0,
              Math.round(Number(qtyData.miktar ?? qtyData.quantity ?? qtyData.stok ?? 0)),
            );
          }
        } catch {
          stockQty = Math.max(
            0,
            Math.round(Number(row.miktar ?? row.stokMiktar ?? 0)),
          );
        }
        out.push({
          erpProductId: code,
          barcode: (row.barcode ?? code).trim(),
          name: (row.stokAdi ?? row.name ?? code).trim() || code,
          stockQuantity: stockQty,
          purchasePrice:
            row.satisFiyat !== undefined
              ? Number(row.satisFiyat)
              : row.alisFiyat !== undefined
                ? Number(row.alisFiyat)
                : undefined,
        });
      }
      if (rows.length < sayfaBoyut) {
        break;
      }
      sayfa += 1;
    }

    return out;
  }

  async updateStock(
    credentials: Record<string, string>,
    productId: string,
    quantity: number,
    note?: string,
  ): Promise<void> {
    const orgId = credentials.organizationId ?? 'global';
    await this.apiWrite(credentials, orgId, 'POST', '/stok/hareket', {
      stokKod: productId,
      miktar: quantity,
      aciklama: note ?? 'Senkronize',
      tarih: todayIsoDate(),
    });
  }

  private async ensureStok(
    credentials: Record<string, string>,
    orgId: string,
    stokKod: string,
    name: string,
  ): Promise<void> {
    try {
      await this.apiGet(credentials, orgId, `/stok/${encodeURIComponent(stokKod)}/miktar`);
      return;
    } catch {
      // yoksa oluştur
    }
    await this.apiWrite(credentials, orgId, 'POST', '/stok/kaydet', {
      stokKod,
      stokAdi: name.slice(0, 200),
    });
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: ErpInvoiceInput,
  ): Promise<ErpInvoice> {
    const orgId = credentials.organizationId ?? 'global';
    const today = todayIsoDate();
    const cariKod = sanitizeCariKod(invoice.orderRef);

    const satirlar: Array<{ stokKod: string; miktar: number; birimFiyat: number }> = [];
    for (const line of invoice.lines) {
      const stokKod = (line.sku ?? line.description).trim();
      await this.ensureStok(credentials, orgId, stokKod, line.description);
      satirlar.push({
        stokKod,
        miktar: line.quantity,
        birimFiyat: line.unitPrice,
      });
    }

    const data = await this.apiWrite<unknown>(credentials, orgId, 'POST', '/satis/fis', {
      tarih: today,
      cariKod,
      cariUnvan: invoice.customerName?.trim() || cariKod,
      satirlar,
      toplam: invoice.totalAmount,
      paraBirimi: invoice.currency,
      referans: invoice.orderRef,
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
