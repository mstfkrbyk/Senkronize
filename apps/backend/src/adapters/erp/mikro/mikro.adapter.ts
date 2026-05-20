import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';

import type { ErpStockCapableAdapter } from '../../../jobs/erp-sync.helpers';
import { isRecord, resolveHostBaseUrl } from '../erp-adapter.utils';
import { ErpRestHttpService } from '../erp-rest-http';

import {
  MIKRO_PAGE_SIZE,
  MIKRO_PLATFORM_KEY,
  MIKRO_REST_API_PATH,
  MIKRO_XML_CONTENT_TYPE,
} from './mikro.constants';
import type { MikroSatisFisResponse, MikroStokRow } from './mikro.types';
import {
  buildMikroDataRequest,
  buildMikroXml,
  extractMikroStokRows,
  extractMikroToken,
  parseMikroXml,
  resolveMikroFirmaKodu,
} from './mikro-xml.helpers';

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

interface MikroTokenCacheEntry {
  token: string;
  expiresAt: number;
}

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
    (typeof row.faturaNo === 'string' && row.faturaNo) ||
    (typeof row.invoiceNumber === 'string' && row.invoiceNumber) ||
    (typeof row.number === 'string' && row.number) ||
    '';
  const id =
    (typeof row.id === 'string' && row.id) ||
    num ||
    'unknown';
  return { id, number: num || id };
}

function mapStokRow(row: MikroStokRow): ErpProduct | null {
  const code = pickStokKod(row);
  if (!code) {
    return null;
  }
  const stockQty = Math.max(
    0,
    Math.round(Number(row.miktar ?? row.stokMiktar ?? row.quantity ?? 0)),
  );
  const purchasePrice =
    row.satisFiyat !== undefined
      ? Number(row.satisFiyat)
      : row.alisFiyat !== undefined
        ? Number(row.alisFiyat)
        : undefined;
  return {
    erpProductId: code,
    barcode: (row.barcode ?? code).trim(),
    name: (row.stokAdi ?? row.name ?? code).trim() || code,
    stockQuantity: stockQty,
    ...(purchasePrice !== undefined && Number.isFinite(purchasePrice)
      ? { purchasePrice }
      : {}),
  };
}

@Injectable()
export class MikroErpAdapter implements IErpAdapter, ErpStockCapableAdapter {
  readonly erpType = MIKRO_PLATFORM_KEY;
  private readonly logger = new Logger(MikroErpAdapter.name);
  private readonly tokenCache = new Map<string, MikroTokenCacheEntry>();

  constructor(private readonly http: ErpRestHttpService) {}

  private tokenCacheKey(credentials: Record<string, string>): string {
    const base = resolveHostBaseUrl(credentials);
    const username = credentials.username?.trim() ?? '';
    const firma = resolveMikroFirmaKodu(credentials);
    return `${base}\0${username}\0${firma}`;
  }

  private baseUrl(credentials: Record<string, string>): string {
    return this.http.buildBaseUrl(credentials, MIKRO_REST_API_PATH);
  }

  private orgId(credentials: Record<string, string>): string {
    return credentials.organizationId ?? 'global';
  }

  private async postXml(
    credentials: Record<string, string>,
    path: string,
    xmlBody: string,
  ): Promise<string> {
    const response = await this.http.request<string>(
      MIKRO_PLATFORM_KEY,
      this.orgId(credentials),
      {
        method: 'POST',
        url: path.startsWith('/') ? path : `/${path}`,
        baseURL: this.baseUrl(credentials),
        data: xmlBody,
        headers: { 'Content-Type': MIKRO_XML_CONTENT_TYPE },
        responseType: 'text',
        timeout: 30_000,
      },
    );
    return typeof response === 'string' ? response : String(response ?? '');
  }

  private async authenticate(credentials: Record<string, string>): Promise<string> {
    const username = credentials.username?.trim();
    const password = credentials.password ?? '';
    const firmaKodu = resolveMikroFirmaKodu(credentials);
    if (!username || !password) {
      throw new Error('Mikro: username ve password zorunludur');
    }

    const cacheKey = this.tokenCacheKey(credentials);
    const cached = this.tokenCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now + 5_000) {
      return cached.token;
    }

    const xml = buildMikroXml({
      username,
      password,
      firma: firmaKodu,
    });
    const raw = await this.postXml(credentials, '/login', xml);
    const parsed = parseMikroXml(raw);
    const token = extractMikroToken(parsed);
    if (!token) {
      throw new Error('Mikro: token alınamadı');
    }

    this.tokenCache.set(cacheKey, {
      token,
      expiresAt: now + 3_600_000,
    });
    return token;
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const token = await this.authenticate(credentials);
      const firmaKodu = resolveMikroFirmaKodu(credentials);
      const xml = buildMikroDataRequest(token, firmaKodu, {
        sayfa: 1,
        satirsayisi: 1,
      });
      const raw = await this.postXml(credentials, '/getstok', xml);
      const rows = extractMikroStokRows(parseMikroXml(raw));
      return {
        success: true,
        companyName: credentials.companyName,
        version: 'xml-rest',
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
    const token = await this.authenticate(credentials);
    const firmaKodu = resolveMikroFirmaKodu(credentials);
    const out: ErpProduct[] = [];
    let sayfa = 1;

    for (let i = 0; i < 200; i += 1) {
      const xml = buildMikroDataRequest(token, firmaKodu, {
        sayfa,
        satirsayisi: MIKRO_PAGE_SIZE,
      });
      const raw = await this.postXml(credentials, '/getstok', xml);
      const rows = extractMikroStokRows(parseMikroXml(raw));
      if (rows.length === 0) {
        break;
      }
      for (const row of rows) {
        const product = mapStokRow(row);
        if (product) {
          out.push(product);
        }
      }
      if (rows.length < MIKRO_PAGE_SIZE) {
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
    const token = await this.authenticate(credentials);
    const firmaKodu = resolveMikroFirmaKodu(credentials);
    const xml = buildMikroDataRequest(token, firmaKodu, {
      stokKod: productId,
      miktar: quantity,
      aciklama: note ?? 'Senkronize',
      tarih: todayIsoDate(),
    });
    await this.postXml(credentials, '/updatestok', xml);
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: ErpInvoiceInput,
  ): Promise<ErpInvoice> {
    const token = await this.authenticate(credentials);
    const firmaKodu = resolveMikroFirmaKodu(credentials);
    const today = todayIsoDate();
    const cariKod = sanitizeCariKod(invoice.orderRef);

    const satirlar = invoice.lines.map((line) => ({
      stokKod: (line.sku ?? line.description).trim(),
      miktar: line.quantity,
      birimFiyat: line.unitPrice,
      aciklama: line.description,
    }));

    const xml = buildMikroDataRequest(token, firmaKodu, {
      tarih: today,
      cariKod,
      cariUnvan: invoice.customerName?.trim() || cariKod,
      toplam: invoice.totalAmount,
      paraBirimi: invoice.currency,
      referans: invoice.orderRef,
      satirlar: JSON.stringify(satirlar),
    });
    const raw = await this.postXml(credentials, '/savefatura', xml);
    const parsed = parseMikroXml(raw);
    const meta = pickInvoiceMeta(
      isRecord(parsed)
        ? ((parsed.response ?? parsed.request ?? parsed) as Record<string, unknown>)
        : parsed,
    );

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
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpInvoice[]> {
    const token = await this.authenticate(credentials);
    const firmaKodu = resolveMikroFirmaKodu(credentials);
    const sinceStr = since ? since.toISOString().slice(0, 10) : undefined;
    const out: ErpInvoice[] = [];
    let sayfa = 1;

    for (let i = 0; i < 100; i += 1) {
      const xml = buildMikroDataRequest(token, firmaKodu, {
        sayfa,
        satirsayisi: MIKRO_PAGE_SIZE,
        ...(sinceStr ? { tarih: sinceStr } : {}),
      });
      const raw = await this.postXml(credentials, '/getfatura', xml);
      const parsed = parseMikroXml(raw);
      const root = isRecord(parsed)
        ? ((parsed.response ?? parsed.request ?? parsed) as Record<string, unknown>)
        : null;
      if (!root) {
        break;
      }

      const rows: Record<string, unknown>[] = [];
      const collect = (node: unknown): void => {
        if (!isRecord(node)) {
          return;
        }
        const hasInvoice =
          node.fisNo !== undefined ||
          node.faturaNo !== undefined ||
          node.invoiceNumber !== undefined;
        if (hasInvoice) {
          rows.push(node);
          return;
        }
        for (const value of Object.values(node)) {
          if (typeof value === 'object' && value !== null) {
            collect(value);
          }
        }
      };
      collect(root);

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const meta = pickInvoiceMeta(row);
        const totalRaw = row.toplam ?? row.totalAmount ?? row.tutar ?? 0;
        const currencyRaw = row.paraBirimi ?? row.currency ?? 'TRY';
        out.push({
          erpInvoiceId: meta.id,
          orderRef: String(row.referans ?? row.orderRef ?? meta.number),
          invoiceNumber: meta.number,
          totalAmount: Number(totalRaw),
          currency: String(currencyRaw),
          issuedAt: String(row.tarih ?? row.issuedAt ?? todayIsoDate()),
          lines: [],
        });
      }

      if (rows.length < MIKRO_PAGE_SIZE) {
        break;
      }
      sayfa += 1;
    }

    return out;
  }
}
