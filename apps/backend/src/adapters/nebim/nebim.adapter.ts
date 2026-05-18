import { Injectable, Logger } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios from 'axios';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { NEBIM_WS_PATH } from './nebim.constants';
import type { NebimInvoiceCreateResponse, NebimSessionResponse } from './nebim.types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function resolveNebimRoot(credentials: Record<string, string>): string {
  const raw = credentials.baseUrl?.trim();
  if (raw) {
    return normalizeBaseUrl(raw);
  }
  const host = credentials.host?.trim();
  if (!host) {
    return '';
  }
  const proto = credentials.useHttps === 'true' ? 'https' : 'http';
  return normalizeBaseUrl(`${proto}://${host}${NEBIM_WS_PATH}`);
}

function readSessionId(data: unknown): string | null {
  if (!isRecord(data)) {
    return null;
  }
  const s = data.SessionID ?? data.SessionId ?? data.sessionId;
  return typeof s === 'string' && s.length > 0 ? s : null;
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
  }
  return [];
}

function pickVariantPart(p: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
  }
  return '';
}

@Injectable()
export class NebimAdapter implements IErpAdapter {
  readonly erpType = 'NEBIM';
  private readonly logger = new Logger(NebimAdapter.name);

  private async openSession(credentials: Record<string, string>): Promise<string> {
    const baseUrl = resolveNebimRoot(credentials);
    const username = credentials.username;
    const password = credentials.password;
    if (!baseUrl || !username || !password) {
      throw new Error('Nebim: baseUrl veya host, username ve password zorunludur');
    }
    try {
      const data = await axiosWithRetry<NebimSessionResponse>(
        {
          method: 'POST',
          url: `${baseUrl}/IntegratorService/Connect`,
          data: { UserName: username, Password: password, ModelType: 33 },
          headers: { 'Content-Type': 'application/json' },
          timeout: 20_000,
        },
        { maxRetries: 2 },
      );
      const sid = readSessionId(data as unknown);
      if (sid) {
        return sid;
      }
    } catch (error) {
      this.logger.warn('Nebim JSON oturumu başarısız, SOAP deneniyor', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
    return this.openSessionSoap(baseUrl, username, password);
  }

  private async openSessionSoap(
    baseUrl: string,
    username: string,
    password: string,
  ): Promise<string> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Connect xmlns="http://tempuri.org/">
      <UserName>${escapeXml(username)}</UserName>
      <Password>${escapeXml(password)}</Password>
    </Connect>
  </soap:Body>
</soap:Envelope>`;
    const { data: xml } = await axios.post<string>(`${baseUrl}/Integrator.asmx`, body, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://tempuri.org/Connect"' },
      timeout: 20_000,
    });
    const sid = parseSoapSessionId(xml);
    if (!sid) {
      throw new Error('Nebim: SOAP oturumu açılamadı');
    }
    return sid;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.openSession(credentials);
      return true;
    } catch (error) {
      this.logger.warn('Nebim bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const baseUrl = resolveNebimRoot(credentials);
      const sessionId = await this.openSession(credentials);
      const data = await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${baseUrl}/api/Inventory/Items`,
          params: { SessionId: sessionId, limit: 500, offset: 0 },
          headers: { 'Content-Type': 'application/json' },
          timeout: 30_000,
        },
        { maxRetries: 2 },
      );
      const raw = normalizeItemsPayload(data);
      return raw.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const codeRaw = p.itemCode ?? p.code ?? p.sku ?? p.barcode;
        const code =
          typeof codeRaw === 'string'
            ? codeRaw.trim()
            : typeof codeRaw === 'number' && Number.isFinite(codeRaw)
              ? String(codeRaw)
              : `row-${i}`;
        const barcodeRaw = p.barcode ?? p.barcode1 ?? code;
        const barcode =
          typeof barcodeRaw === 'string'
            ? barcodeRaw.trim()
            : typeof barcodeRaw === 'number' && Number.isFinite(barcodeRaw)
              ? String(barcodeRaw)
              : code;
        const nameBase =
          typeof p.description === 'string'
            ? p.description.trim()
            : typeof p.name === 'string'
              ? p.name.trim()
              : code;
        const beden = pickVariantPart(p, ['beden', 'size', 'SizeCode', 'dimension1']);
        const renk = pickVariantPart(p, ['renk', 'color', 'ColorCode', 'dimension2']);
        const name = [nameBase, beden, renk].filter((x) => x.length > 0).join(' · ') || code;
        const variantKey = [beden, renk].filter((x) => x.length > 0).join('|');
        const erpProductId = variantKey.length > 0 ? `${code}#${variantKey}` : code;
        const stockRaw = p.stock ?? p.stockQuantity ?? p.quantityOnHand ?? 0;
        const purchaseRaw = p.purchasePrice ?? p.cost;
        const purchasePrice =
          purchaseRaw !== undefined && purchaseRaw !== null
            ? Number(purchaseRaw)
            : undefined;
        return {
          erpProductId,
          barcode,
          name,
          stockQuantity: Math.max(0, Math.round(Number(stockRaw))),
          ...(Number.isFinite(purchasePrice) ? { purchasePrice } : {}),
        };
      });
    } catch (error) {
      this.logger.warn('Nebim ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const baseUrl = resolveNebimRoot(credentials);
    const sessionId = await this.openSession(credentials);
    const today = new Date().toISOString().split('T')[0];
    const data = await axiosWithRetry<NebimInvoiceCreateResponse>(
      {
        method: 'POST',
        url: `${baseUrl}/api/Sales/Invoice`,
        data: {
          SessionId: sessionId,
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
        headers: { 'Content-Type': 'application/json' },
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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseSoapSessionId(xml: string): string | null {
  const m =
    xml.match(/<SessionID[^>]*>([^<]+)<\/SessionID>/i) ??
    xml.match(/<SessionId[^>]*>([^<]+)<\/SessionId>/i);
  if (m?.[1]) {
    return m[1].trim();
  }
  return null;
}
