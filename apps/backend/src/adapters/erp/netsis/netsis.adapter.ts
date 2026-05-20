import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { SoapClient } from '../../../common/soap/soap-client';
import { axiosWithRetry } from '../../../common/utils/http-retry';
import type { ErpInventoryPushItem } from '../erp-adapter.types';
import {
  isRecord,
  normalizeArrayPayload,
  normalizeBaseUrl,
  runErpConnectionTest,
} from '../erp-adapter.utils';
import {
  NETSIS_REST_INVOICE_PATH,
  NETSIS_REST_STOCK_PATH,
  NETSIS_SOAP_PATH,
} from './netsis.constants';

type NetsisApiMode = 'soap' | 'rest';

interface NetsisConfig {
  mode: NetsisApiMode;
  restBaseUrl: string;
  soapUrl: string;
  username: string;
  password: string;
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
  const itemKeys = ['Item', 'Stok', 'STOK', 'row', 'Table', 'StokKarti'];
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
  const codeRaw = p.KOD ?? p.kod ?? p.code ?? p.itemCode ?? p.StokKodu;
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
    p.STOK_ADI ?? p.StokAdi ?? p.description ?? p.name ?? p.ACIKLAMA ?? code;
  const name =
    typeof nameRaw === 'string' ? nameRaw.trim() || code : String(nameRaw);
  const stockRaw = p.MIKTAR ?? p.miktar ?? p.stock ?? p.stockQuantity ?? 0;
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

@Injectable()
export class NetsisErpAdapter implements IErpAdapter {
  readonly erpType = 'NETSIS';
  private readonly logger = new Logger(NetsisErpAdapter.name);

  private resolveConfig(credentials: Record<string, string>): NetsisConfig {
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    if (!username || !password) {
      throw new Error('Netsis: username ve password zorunludur');
    }

    const explicitMode = credentials.apiMode?.trim().toLowerCase();
    const baseUrlRaw = credentials.baseUrl?.trim();
    const host = credentials.serverIp?.trim() ?? credentials.host?.trim();
    const port = credentials.port?.trim() ?? '80';
    const proto =
      credentials.useHttps === 'true' || port === '443' ? 'https' : 'http';

    let restBaseUrl = '';
    if (baseUrlRaw) {
      restBaseUrl = normalizeBaseUrl(baseUrlRaw);
    } else if (host) {
      const authority =
        port && port !== '80' && port !== '443' ? `${host}:${port}` : host;
      restBaseUrl = normalizeBaseUrl(`${proto}://${authority}`);
    }

    if (!restBaseUrl) {
      throw new Error('Netsis: baseUrl veya serverIp/host zorunludur');
    }

    const soapUrl = restBaseUrl.includes('.asmx')
      ? restBaseUrl
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
    return new SoapClient(config.soapUrl, {
      username: config.username,
      password: config.password,
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

  private async fetchProductsSoap(config: NetsisConfig, sku?: string): Promise<ErpProduct[]> {
    const soap = this.getSoapClient(config);
    const inner = sku
      ? `${SoapClient.escapeElement('KOD', sku)}${SoapClient.escapeElement('AKTIF', 'E')}`
      : `${SoapClient.escapeElement('AKTIF', 'E')}`;
    const response = await soap.call('GetItemList', inner);
    const rows: unknown[] = [];
    collectSoapRows(response, rows);
    const list = rows.length > 0 ? rows : normalizeArrayPayload(response);
    return list.map((row, i) => mapNetsisRow(row, i));
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
      return await this.fetchProductsSoap(config);
    } catch (error) {
      this.logger.warn('Netsis ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async pushInventory(
    credentials: Record<string, string>,
    items: ErpInventoryPushItem[],
  ): Promise<void> {
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
    const soap = this.getSoapClient(config);
    for (const item of items) {
      const body = `${SoapClient.escapeElement('KOD', item.erpProductId)}${SoapClient.escapeElement('MIKTAR', item.quantity)}`;
      await soap.call('UpdateItem', body);
    }
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    return runErpConnectionTest(async () => {
      const config = this.resolveConfig(credentials);
      const products =
        config.mode === 'rest'
          ? await this.fetchProductsRest(config)
          : await this.fetchProductsSoap(config);
      return {
        productCount: products.length,
        version: config.mode === 'soap' ? 'soap' : 'rest',
        companyName: config.databaseAlias,
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
    const body = `${SoapClient.escapeElement('CARI_KOD', customerCode)}${SoapClient.escapeElement('TARIH', today)}${SoapClient.escapeElement('PARA_BIRIMI', invoice.currency)}<Kalemler>${lineXml}</Kalemler>`;
    const response = await this.getSoapClient(config).call('CreateSalesInvoice', body);
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
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}

/** @deprecated NetsisAdapter — geriye dönük import uyumluluğu */
export { NetsisErpAdapter as NetsisAdapter };
