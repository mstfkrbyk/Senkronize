import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { SoapClient } from '../../../common/soap/soap-client';
import { axiosWithRetry } from '../../../common/utils/http-retry';
import type { ErpStockCapableAdapter } from '../../../jobs/erp-sync.helpers';
import type { ErpInventoryPushItem } from '../erp-adapter.types';
import {
  isRecord,
  normalizeArrayPayload,
  normalizeBaseUrl,
  resolveHostBaseUrl,
  runErpConnectionTest,
} from '../erp-adapter.utils';
import {
  NETSIS_REST_INVOICE_PATH,
  NETSIS_REST_STOCK_PATH,
  NETSIS_SOAP_ACTION_BEGIN_SESSION,
  NETSIS_SOAP_ACTION_END_SESSION,
  NETSIS_SOAP_ACTION_EXECUTE_DATASET,
  NETSIS_SOAP_ACTION_SAVE_DATA,
  NETSIS_SOAP_PATH,
  NETSIS_STOCK_MOVEMENT_TABLE,
  NETSIS_STOCK_PAGE_SIZE,
} from './netsis.constants';

type NetsisApiMode = 'soap' | 'rest';

interface NetsisConfig {
  mode: NetsisApiMode;
  restBaseUrl: string;
  soapUrl: string;
  username: string;
  password: string;
  firmNo: string;
  databaseAlias?: string;
}

function pickInvoiceMeta(data: unknown): { id: string; number: string } {
  if (!isRecord(data)) {
    return { id: 'unknown', number: 'unknown' };
  }
  const num =
    (typeof data.invoiceNumber === 'string' && data.invoiceNumber) ||
    (typeof data.number === 'string' && data.number) ||
    (typeof data.invoiceNo === 'string' && data.invoiceNo) ||
    (typeof data.FaturaNo === 'string' && data.FaturaNo) ||
    '';
  const id =
    (typeof data.id === 'string' && data.id) ||
    (typeof data.invoiceId === 'string' && data.invoiceId) ||
    (typeof data.FaturaId === 'string' && data.FaturaId) ||
    num ||
    'unknown';
  return { id, number: num || id };
}

function pickSoapString(response: Record<string, unknown>, suffix: string): string | null {
  const direct = response[suffix];
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }
  const resultKey = `${suffix}Result`;
  const result = response[resultKey];
  if (typeof result === 'string' && result.length > 0) {
    return result;
  }
  if (isRecord(result) && typeof result._text === 'string') {
    return result._text;
  }
  for (const value of Object.values(response)) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

function collectSoapRows(node: unknown, acc: unknown[]): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectSoapRows(item, acc);
    }
    return;
  }
  if (!isRecord(node)) {
    return;
  }
  const itemKeys = [
    'Item',
    'Stok',
    'STOK',
    'row',
    'Table',
    'StokKarti',
    'STOKKODU',
    'NewDataSet',
    'Table1',
  ];
  for (const key of itemKeys) {
    const v = node[key];
    if (Array.isArray(v)) {
      acc.push(...v);
      return;
    }
    if (isRecord(v)) {
      acc.push(v);
      return;
    }
  }
  const hasStockField =
    'KOD' in node ||
    'kod' in node ||
    'STOKKODU' in node ||
    'StokKodu' in node ||
    'code' in node ||
    'MIKTAR' in node ||
    'miktar' in node ||
    'stock' in node;
  if (hasStockField) {
    acc.push(node);
    return;
  }
  for (const value of Object.values(node)) {
    if (typeof value === 'object' && value !== null) {
      collectSoapRows(value, acc);
    }
  }
}

function mapNetsisRow(row: unknown, index: number): ErpProduct {
  const p = isRecord(row) ? row : {};
  const codeRaw =
    p.STOKKODU ?? p.StokKodu ?? p.KOD ?? p.kod ?? p.code ?? p.itemCode;
  const code =
    typeof codeRaw === 'string'
      ? codeRaw.trim()
      : typeof codeRaw === 'number' && Number.isFinite(codeRaw)
        ? String(codeRaw)
        : `row-${index}`;
  const barcodeRaw = p.barcode ?? p.BARKOD ?? p.KOD ?? code;
  const barcode =
    typeof barcodeRaw === 'string'
      ? barcodeRaw.trim()
      : typeof barcodeRaw === 'number' && Number.isFinite(barcodeRaw)
        ? String(barcodeRaw)
        : code;
  const nameRaw =
    p.STOK_ADI ??
    p.StokAdi ??
    p.STOKADI ??
    p.description ??
    p.name ??
    p.ACIKLAMA ??
    code;
  const name =
    typeof nameRaw === 'string' ? nameRaw.trim() || code : String(nameRaw);
  const stockRaw =
    p.MIKTAR ?? p.miktar ?? p.stock ?? p.stockQuantity ?? p.BAKIYE ?? 0;
  const purchaseRaw = p.purchasePrice ?? p.ALIS_FIYAT ?? p.buyPrice;
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
}

function buildStockMovementXml(items: ErpInventoryPushItem[]): string {
  const rows = items
    .map(
      (item) =>
        `<row>${SoapClient.escapeElement('STOK_KODU', item.erpProductId)}${SoapClient.escapeElement('MIKTAR', item.quantity)}${SoapClient.escapeElement('GC', 'G')}</row>`,
    )
    .join('');
  return `<${NETSIS_STOCK_MOVEMENT_TABLE}>${rows}</${NETSIS_STOCK_MOVEMENT_TABLE}>`;
}

@Injectable()
export class NetsisErpAdapter implements IErpAdapter, ErpStockCapableAdapter {
  readonly erpType = 'NETSIS';
  private readonly logger = new Logger(NetsisErpAdapter.name);
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    removeNSPrefix: true,
  });

  private resolveConfig(credentials: Record<string, string>): NetsisConfig {
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    if (!username || !password) {
      throw new Error('Netsis: username ve password zorunludur');
    }

    const firmNo = credentials.firmNo?.trim() ?? credentials.firmaNo?.trim() ?? '1';
    const explicitMode = credentials.apiMode?.trim().toLowerCase();

    let restBaseUrl = '';
    try {
      restBaseUrl = resolveHostBaseUrl(credentials);
    } catch {
      const baseUrlRaw = credentials.baseUrl?.trim();
      if (baseUrlRaw) {
        restBaseUrl = normalizeBaseUrl(baseUrlRaw);
      }
    }

    if (!restBaseUrl) {
      throw new Error('Netsis: baseUrl veya serverIp/host zorunludur');
    }

    const soapUrl = restBaseUrl.includes('.asmx')
      ? restBaseUrl.replace(/\?WSDL$/i, '')
      : `${restBaseUrl}${NETSIS_SOAP_PATH}`;

    let mode: NetsisApiMode = 'soap';
    if (explicitMode === 'rest') {
      mode = 'rest';
    } else if (explicitMode === 'soap') {
      mode = 'soap';
    } else if (
      restBaseUrl.includes('/api/v1') ||
      credentials.databaseAlias?.trim()
    ) {
      mode = 'rest';
    }

    return {
      mode,
      restBaseUrl,
      soapUrl,
      username,
      password,
      firmNo,
      databaseAlias: credentials.databaseAlias?.trim(),
    };
  }

  private getRestClient(config: NetsisConfig): AxiosInstance {
    const token = Buffer.from(
      `${config.username}:${config.password}`,
      'utf8',
    ).toString('base64');
    return axios.create({
      baseURL: config.restBaseUrl,
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  private getSoapClient(config: NetsisConfig): SoapClient {
    return new SoapClient(config.soapUrl, null);
  }

  private parseDatasetPayload(raw: string | null): unknown[] {
    if (!raw || raw.trim().length === 0) {
      return [];
    }
    const trimmed = raw.trim();
    if (trimmed.startsWith('<')) {
      try {
        const parsed = this.xmlParser.parse(trimmed) as unknown;
        const rows: unknown[] = [];
        collectSoapRows(parsed, rows);
        return rows.length > 0 ? rows : normalizeArrayPayload(parsed);
      } catch {
        return [];
      }
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return normalizeArrayPayload(parsed);
    } catch {
      return [];
    }
  }

  private async withSoapSession<T>(
    config: NetsisConfig,
    fn: (sessionId: string, soap: SoapClient) => Promise<T>,
  ): Promise<T> {
    const soap = this.getSoapClient(config);
    const beginBody = `${SoapClient.escapeElement('UserName', config.username)}${SoapClient.escapeElement('UserPass', config.password)}${SoapClient.escapeElement('FirmaNO', config.firmNo)}`;
    const beginRes = await soap.call(NETSIS_SOAP_ACTION_BEGIN_SESSION, beginBody);
    const sessionId = pickSoapString(beginRes, 'BeginSession');
    if (!sessionId) {
      throw new Error('Netsis: BeginSession oturum kimliği alınamadı');
    }
    try {
      return await fn(sessionId, soap);
    } finally {
      try {
        await soap.call(
          NETSIS_SOAP_ACTION_END_SESSION,
          SoapClient.escapeElement('sessionId', sessionId),
        );
      } catch (endError) {
        this.logger.warn('Netsis EndSession başarısız', {
          error: endError instanceof Error ? endError.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  private async executeDataset(
    config: NetsisConfig,
    sql: string,
  ): Promise<unknown[]> {
    return this.withSoapSession(config, async (sessionId, soap) => {
      const body = `${SoapClient.escapeElement('sessionId', sessionId)}${SoapClient.escapeElement('strSQL', sql)}`;
      const response = await soap.call(NETSIS_SOAP_ACTION_EXECUTE_DATASET, body);
      const raw = pickSoapString(response, 'ExecuteDataset');
      const rows = this.parseDatasetPayload(raw);
      if (rows.length > 0) {
        return rows;
      }
      const fallback: unknown[] = [];
      collectSoapRows(response, fallback);
      return fallback.length > 0 ? fallback : normalizeArrayPayload(response);
    });
  }

  private async saveData(
    config: NetsisConfig,
    tableName: string,
    xml: string,
  ): Promise<Record<string, unknown>> {
    return this.withSoapSession(config, async (sessionId, soap) => {
      const body = `${SoapClient.escapeElement('sessionId', sessionId)}${SoapClient.escapeElement('XML', xml)}${SoapClient.escapeElement('TableName', tableName)}`;
      return soap.call(NETSIS_SOAP_ACTION_SAVE_DATA, body);
    });
  }

  private async restGetToken(config: NetsisConfig): Promise<string | null> {
    if (!config.databaseAlias) {
      return null;
    }
    const { data } = await axios.post<unknown>(
      `${config.restBaseUrl}/netsis/api/v1/auth/token`,
      {
        username: config.username,
        password: config.password,
        database: config.databaseAlias,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 12_000 },
    );
    if (!isRecord(data)) {
      return null;
    }
    const t = data.token ?? data.access_token;
    return typeof t === 'string' && t.length > 0 ? t : null;
  }

  private async getRestClientWithAuth(
    config: NetsisConfig,
  ): Promise<AxiosInstance> {
    const token = await this.restGetToken(config);
    if (token) {
      return axios.create({
        baseURL: config.restBaseUrl,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      });
    }
    return this.getRestClient(config);
  }

  private async fetchProductsSoap(
    config: NetsisConfig,
    page = 0,
    sku?: string,
  ): Promise<ErpProduct[]> {
    const offset = page * NETSIS_STOCK_PAGE_SIZE;
    const sql = sku
      ? `SELECT TOP ${NETSIS_STOCK_PAGE_SIZE} * FROM STOK WHERE BLOKE = 0 AND STOKKODU = '${sku.replace(/'/g, "''")}'`
      : `SELECT TOP ${NETSIS_STOCK_PAGE_SIZE} * FROM STOK WHERE BLOKE = 0 ORDER BY STOKKODU OFFSET ${offset} ROWS`;
    const rows = await this.executeDataset(config, sql);
    return rows.map((row, i) => mapNetsisRow(row, i));
  }

  private async fetchAllProductsSoap(config: NetsisConfig): Promise<ErpProduct[]> {
    const out: ErpProduct[] = [];
    for (let page = 0; page < 200; page += 1) {
      const batch = await this.fetchProductsSoap(config, page);
      if (batch.length === 0) {
        break;
      }
      out.push(...batch);
      if (batch.length < NETSIS_STOCK_PAGE_SIZE) {
        break;
      }
    }
    return out;
  }

  private async fetchProductsRest(config: NetsisConfig): Promise<ErpProduct[]> {
    const client = await this.getRestClientWithAuth(config);
    const path = config.restBaseUrl.includes('/netsis/api')
      ? '/items'
      : NETSIS_REST_STOCK_PATH;
    const data = await axiosWithRetry<unknown>(
      {
        method: 'GET',
        url: path,
        baseURL: client.defaults.baseURL,
        headers: client.defaults.headers as Record<string, string>,
        params: { limit: 500, offset: 0 },
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
    return normalizeArrayPayload(data).map((row, i) => mapNetsisRow(row, i));
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    try {
      const config = this.resolveConfig(credentials);
      if (config.mode === 'rest') {
        return await this.fetchProductsRest(config);
      }
      return await this.fetchAllProductsSoap(config);
    } catch (error) {
      this.logger.warn('Netsis ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    productId: string,
    quantity: number,
    _note?: string,
  ): Promise<void> {
    await this.pushInventory(credentials, [
      { erpProductId: productId, quantity },
    ]);
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }
    const config = this.resolveConfig(credentials);
    if (config.mode === 'rest') {
      const client = await this.getRestClientWithAuth(config);
      for (const item of items) {
        await client.put(`/api/v1/stok/${item.erpProductId}`, {
          miktar: item.quantity,
        });
      }
      return;
    }
    const xml = buildStockMovementXml(items);
    await this.saveData(config, NETSIS_STOCK_MOVEMENT_TABLE, xml);
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    return runErpConnectionTest(async () => {
      const config = this.resolveConfig(credentials);
      const products =
        config.mode === 'rest'
          ? await this.fetchProductsRest(config)
          : await this.fetchProductsSoap(config, 0);
      return {
        productCount: products.length,
        version: config.mode === 'soap' ? 'soap-dotnet' : 'rest',
        companyName: config.firmNo,
      };
    });
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const config = this.resolveConfig(credentials);
    const today = new Date().toISOString().split('T')[0];
    const customerCode =
      invoice.orderRef.length > 0 ? invoice.orderRef : 'PERAKENDE';

    if (config.mode === 'rest') {
      const client = await this.getRestClientWithAuth(config);
      const { data } = await client.post<unknown>(NETSIS_REST_INVOICE_PATH, {
        faturaTarihi: today,
        cariKodu: customerCode,
        kalemler: invoice.lines.map((line) => ({
          stokKodu: line.description,
          miktar: line.quantity,
          birimFiyat: line.unitPrice,
          kdvOrani: line.taxRate,
        })),
        paraBirimi: invoice.currency,
        toplam: invoice.totalAmount,
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

    const lineXml = invoice.lines
      .map(
        (line) =>
          `<Kalem>${SoapClient.escapeElement('STOK_KODU', line.description)}${SoapClient.escapeElement('MIKTAR', line.quantity)}${SoapClient.escapeElement('FIYAT', line.unitPrice)}${SoapClient.escapeElement('KDV', line.taxRate)}</Kalem>`,
      )
      .join('');
    const invoiceXml = `<FATURA>${SoapClient.escapeElement('CARI_KOD', customerCode)}${SoapClient.escapeElement('TARIH', today)}${SoapClient.escapeElement('PARA_BIRIMI', invoice.currency)}<Kalemler>${lineXml}</Kalemler></FATURA>`;
    const response = await this.saveData(config, 'FATURA', invoiceXml);
    const meta = pickInvoiceMeta(response);
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
    const config = this.resolveConfig(credentials);
    if (config.mode === 'rest') {
      return [];
    }
    const dateFilter = since
      ? since.toISOString().slice(0, 10).replace(/-/g, '')
      : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const sql = `SELECT TOP 200 * FROM FATURA WHERE TARIH >= '${dateFilter}' ORDER BY TARIH DESC`;
      const rows = await this.executeDataset(config, sql);
      return rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const num =
          (typeof p.FaturaNo === 'string' && p.FaturaNo) ||
          (typeof p.FATURA_NO === 'string' && p.FATURA_NO) ||
          `row-${i}`;
        return {
          erpInvoiceId: num,
          orderRef: num,
          invoiceNumber: num,
          totalAmount: Number(p.TOPLAM ?? p.total ?? 0),
          currency: 'TRY',
          issuedAt: todayIsoFromRow(p),
          lines: [],
        };
      });
    } catch (error) {
      this.logger.warn('Netsis fatura listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }
}

function todayIsoFromRow(row: Record<string, unknown>): string {
  const raw = row.TARIH ?? row.tarih ?? row.date;
  if (typeof raw === 'string' && raw.length >= 8) {
    const d = raw.replace(/\D/g, '').slice(0, 8);
    if (d.length === 8) {
      return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/** @deprecated NetsisAdapter — geriye dönük import uyumluluğu */
export { NetsisErpAdapter as NetsisAdapter };
