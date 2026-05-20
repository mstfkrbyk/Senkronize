import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import { XMLParser } from 'fast-xml-parser';

import { axiosWithRetry } from '../../common/utils/http-retry';
import {
  ISNET_PATH_ORDER_SAVE,
  ISNET_PATH_PRODUCT_LIST,
} from './isnet.constants';
import type { IsnetInvoiceCreateResponse } from './isnet.types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function resolveIsnetApiRoot(credentials: Record<string, string>): string {
  const raw = credentials.baseUrl?.trim();
  if (raw) {
    return normalizeBaseUrl(raw);
  }
  const host = credentials.host?.trim();
  if (!host) {
    return '';
  }
  const useHttps = credentials.useHttps !== 'false';
  const scheme = useHttps ? 'https' : 'http';
  return normalizeBaseUrl(`${scheme}://${host}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildAuthBlock(credentials: Record<string, string>): string {
  const username = credentials.username ?? '';
  const password = credentials.password ?? '';
  const companyCode = credentials.companyCode ?? '';
  return `<Auth>
    <UserName>${escapeXml(username)}</UserName>
    <Password>${escapeXml(password)}</Password>
    <CompanyCode>${escapeXml(companyCode)}</CompanyCode>
  </Auth>`;
}

function buildRequestDocument(credentials: Record<string, string>, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  ${buildAuthBlock(credentials)}
  ${body}
</Request>`;
}

function collectProductRows(node: unknown, acc: Record<string, unknown>[]): void {
  if (node === null || node === undefined) {
    return;
  }
  if (Array.isArray(node)) {
    for (const x of node) {
      collectProductRows(x, acc);
    }
    return;
  }
  if (!isRecord(node)) {
    return;
  }
  const hasProductShape =
    node.Barcode !== undefined ||
    node.barcode !== undefined ||
    node.ProductCode !== undefined ||
    node.productCode !== undefined ||
    node.SKU !== undefined ||
    node.ItemCode !== undefined ||
    node.Code !== undefined;
  if (hasProductShape) {
    acc.push(node);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    const key = k.toLowerCase();
    if (key === 'auth') {
      continue;
    }
    if (typeof v === 'object' && v !== null) {
      collectProductRows(v, acc);
    }
  }
}

function parseXmlDocument(xml: string): unknown {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    removeNSPrefix: true,
  });
  return parser.parse(xml) as unknown;
}

function pickInvoiceMetaFromXml(parsed: unknown): { id: string; number: string } {
  if (!isRecord(parsed)) {
    return { id: 'unknown', number: 'unknown' };
  }
  const root = parsed.Request ?? parsed.Response ?? parsed;
  const r = isRecord(root) ? root : parsed;
  const orderId =
    (typeof r.OrderId === 'string' && r.OrderId) ||
    (typeof r.orderId === 'string' && r.orderId) ||
    (typeof r.Id === 'string' && r.Id) ||
    (typeof r.DocumentNo === 'string' && r.DocumentNo) ||
    '';
  const num =
    (typeof r.DocumentNo === 'string' && r.DocumentNo) ||
    (typeof r.OrderNo === 'string' && r.OrderNo) ||
    orderId ||
    '';
  return { id: orderId || num || 'unknown', number: num || orderId || 'unknown' };
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
    if (Array.isArray(data.products)) {
      return data.products;
    }
  }
  return [];
}

@Injectable()
export class IsnetAdapter implements IErpAdapter {
  readonly erpType = 'ISNET';
  private readonly logger = new Logger(IsnetAdapter.name);

  private usesXmlApi(credentials: Record<string, string>): boolean {
    const u = credentials.username?.trim();
    const p = credentials.password?.trim();
    const c = credentials.companyCode?.trim();
    return Boolean(u && p && c);
  }

  private authHeadersJson(credentials: Record<string, string>): Record<string, string> {
    const apiKey = credentials.apiKey;
    const username = credentials.username;
    const password = credentials.password;
    if (apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    }
    if (username && password) {
      const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
      return {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      };
    }
    throw new Error('İşnet: XML modu için username+password+companyCode veya apiKey zorunludur');
  }

  private async postServiceXml(
    credentials: Record<string, string>,
    relativePath: string,
    innerXml: string,
  ): Promise<string> {
    const baseUrl = resolveIsnetApiRoot(credentials);
    if (!baseUrl) {
      throw new Error('İşnet: baseUrl veya host zorunludur');
    }
    const document = buildRequestDocument(credentials, innerXml);
    const raw = await axiosWithRetry<string>(
      {
        method: 'POST',
        url: `${baseUrl}${relativePath}`,
        data: document,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        responseType: 'text',
        transformResponse: [(data) => data],
        timeout: 30_000,
      },
      { maxRetries: 2, retryOn: [429, 500, 502, 503, 504] },
    );
    return typeof raw === 'string' ? raw : String(raw);
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    const baseUrl = resolveIsnetApiRoot(credentials);
    if (!baseUrl) {
      return { success: false };
    }
    if (this.usesXmlApi(credentials)) {
      try {
        const inner = `<Products><Filter><IsActive>1</IsActive></Filter></Products>`;
        await this.postServiceXml(credentials, ISNET_PATH_PRODUCT_LIST, inner);
        return { success: true };
      } catch (error) {
        this.logger.warn('İşnet XML bağlantı testi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        return { success: false };
      }
    }
    try {
      await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${baseUrl}/health`,
          headers: this.authHeadersJson(credentials),
          timeout: 10_000,
        },
        { maxRetries: 1, retryOn: [429, 500, 502, 503, 504] },
      );
      return { success: true };
    } catch {
      try {
        await axiosWithRetry<unknown>(
          {
            method: 'GET',
            url: `${baseUrl}/products`,
            params: { limit: 1 },
            headers: this.authHeadersJson(credentials),
            timeout: 10_000,
          },
          { maxRetries: 1, retryOn: [429, 500, 502, 503, 504] },
        );
        return { success: true };
      } catch (error) {
        this.logger.warn('İşnet bağlantı testi başarısız', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        return { success: false };
      }
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const baseUrl = resolveIsnetApiRoot(credentials);
    if (!baseUrl) {
      throw new Error('İşnet: baseUrl veya host zorunludur');
    }
    if (this.usesXmlApi(credentials)) {
      try {
        const inner = `<Products><Filter><IsActive>1</IsActive></Filter></Products>`;
        const xml = await this.postServiceXml(credentials, ISNET_PATH_PRODUCT_LIST, inner);
        const parsed = parseXmlDocument(xml);
        const rows: Record<string, unknown>[] = [];
        collectProductRows(parsed, rows);
        return rows.map((p, i) => {
          const codeRaw = p.ProductCode ?? p.Code ?? p.SKU ?? p.ItemCode ?? p.productCode;
          const code =
            typeof codeRaw === 'string'
              ? codeRaw.trim()
              : typeof codeRaw === 'number' && Number.isFinite(codeRaw)
                ? String(codeRaw)
                : `row-${i}`;
          const barcodeRaw = p.Barcode ?? p.barcode ?? code;
          const barcode =
            typeof barcodeRaw === 'string'
              ? barcodeRaw.trim()
              : typeof barcodeRaw === 'number' && Number.isFinite(barcodeRaw)
                ? String(barcodeRaw)
                : code;
          const nameRaw = p.ProductName ?? p.Name ?? p.Description ?? code;
          const name =
            typeof nameRaw === 'string' ? nameRaw.trim() || code : String(nameRaw);
          const stockRaw = p.Stock ?? p.Quantity ?? p.stockQuantity ?? 0;
          const priceRaw = p.SalesPrice ?? p.Price ?? p.ListPrice;
          const purchasePrice =
            priceRaw !== undefined && priceRaw !== null
              ? Number(priceRaw)
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
        this.logger.warn('İşnet XML ürün listesi alınamadı', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        return [];
      }
    }
    try {
      const data = await axiosWithRetry<unknown>(
        {
          method: 'GET',
          url: `${baseUrl}/products`,
          params: { limit: 500, offset: 0 },
          headers: this.authHeadersJson(credentials),
          timeout: 30_000,
        },
        { maxRetries: 2 },
      );
      const raw = normalizeItemsPayload(data);
      return raw.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const codeRaw = p.code ?? p.sku ?? p.productCode;
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
        const nameRaw = p.name ?? p.title ?? code;
        const name =
          typeof nameRaw === 'string' ? nameRaw.trim() || code : String(nameRaw);
        const stockRaw = p.stock ?? p.stockQuantity ?? 0;
        const purchaseRaw = p.purchasePrice ?? p.price;
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
      this.logger.warn('İşnet ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const baseUrl = resolveIsnetApiRoot(credentials);
    if (!baseUrl) {
      throw new Error('İşnet: baseUrl veya host zorunludur');
    }
    const today = new Date().toISOString().split('T')[0];
    if (this.usesXmlApi(credentials)) {
      const linesXml = invoice.lines
        .map(
          (l, idx) => `<Line>
          <LineNo>${idx + 1}</LineNo>
          <Description>${escapeXml(l.description)}</Description>
          <Quantity>${String(l.quantity)}</Quantity>
          <UnitPrice>${String(l.unitPrice)}</UnitPrice>
          <TaxRate>${String(l.taxRate)}</TaxRate>
          <LineTotal>${String(l.total)}</LineTotal>
        </Line>`,
        )
        .join('');
      const inner = `<Order>
      <ExternalRef>${escapeXml(invoice.orderRef)}</ExternalRef>
      <Currency>${escapeXml(invoice.currency)}</Currency>
      <TotalAmount>${String(invoice.totalAmount)}</TotalAmount>
      <IssueDate>${escapeXml(today)}</IssueDate>
      <Lines>${linesXml}</Lines>
    </Order>`;
      const xml = await this.postServiceXml(credentials, ISNET_PATH_ORDER_SAVE, inner);
      const parsed = parseXmlDocument(xml);
      const meta = pickInvoiceMetaFromXml(parsed);
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
    const data = await axiosWithRetry<IsnetInvoiceCreateResponse>(
      {
        method: 'POST',
        url: `${baseUrl}/orders/import`,
        data: {
          externalOrderRef: invoice.orderRef,
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
        headers: this.authHeadersJson(credentials),
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
    const d = isRecord(data as unknown) ? (data as unknown as Record<string, unknown>) : {};
    const num =
      (typeof d.invoiceNumber === 'string' && d.invoiceNumber) ||
      (typeof d.number === 'string' && d.number) ||
      '';
    const id =
      (typeof d.id === 'string' && d.id) ||
      (typeof d.invoiceId === 'string' && d.invoiceId) ||
      num ||
      'unknown';
    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: num || id,
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
