import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { isRecord, normalizeBaseUrl } from './erp-adapter.utils';

const LOGO_CLOUD_BASE_URL = 'https://cloud.logo.com.tr/api/v1';

interface LogoMaterialRow {
  logicalref: number;
  code: string;
  name: string;
  onhand?: number;
}

interface LogoMaterialsResponse {
  value: LogoMaterialRow[];
}

interface LogoOrderRow {
  logicalref: number;
  ficheno?: string;
  date?: string;
  total?: number;
}

interface LogoOrdersResponse {
  value: LogoOrderRow[];
}

function resolveApiToken(credentials: Record<string, string>): string {
  const token =
    credentials.apiKey?.trim() ||
    credentials.apiToken?.trim() ||
    credentials.token?.trim();
  if (!token) {
    throw new Error('Logo: apiKey (Bearer token) zorunludur');
  }
  return token;
}

@Injectable()
export class LogoErpAdapter implements IErpAdapter {
  readonly erpType = 'LOGO';
  private readonly logger = new Logger(LogoErpAdapter.name);

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const apiToken = resolveApiToken(credentials);
    const baseUrl = normalizeBaseUrl(
      credentials.baseUrl?.trim() || LOGO_CLOUD_BASE_URL,
    );
    return axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    try {
      const client = this.getClient(credentials);
      const data = await axiosWithRetry<LogoMaterialsResponse>(
        {
          method: 'GET',
          url: '/materials',
          baseURL: client.defaults.baseURL,
          headers: client.defaults.headers as Record<string, string>,
          params: { '$filter': 'type eq 1', '$top': 1, '$skip': 0 },
          timeout: 20_000,
        },
        { maxRetries: 2 },
      );
      return {
        success: true,
        companyName: credentials.companyName,
        version: 'v1',
        productCount: data.value.length,
      };
    } catch (error) {
      this.logger.warn('Logo bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { success: false };
    }
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const client = this.getClient(credentials);
    const out: ErpProduct[] = [];
    let skip = 0;
    const top = 100;

    while (skip <= 10_000) {
      const data = await axiosWithRetry<LogoMaterialsResponse>(
        {
          method: 'GET',
          url: '/materials',
          baseURL: client.defaults.baseURL,
          headers: client.defaults.headers as Record<string, string>,
          params: { '$filter': 'type eq 1', '$top': top, '$skip': skip },
          timeout: 30_000,
        },
        { maxRetries: 2 },
      );
      if (data.value.length === 0) {
        break;
      }
      for (const row of data.value) {
        out.push({
          erpProductId: String(row.logicalref),
          barcode: row.code.trim(),
          name: row.name.trim(),
          stockQuantity: Math.max(0, Math.round(Number(row.onhand ?? 0))),
        });
      }
      if (data.value.length < top) {
        break;
      }
      skip += top;
    }

    return out;
  }

  async updateStock(
    credentials: Record<string, string>,
    materialLogicalref: string,
    quantity: number,
  ): Promise<void> {
    const client = this.getClient(credentials);
    const today = new Date().toISOString().slice(0, 10);
    await axiosWithRetry(
      {
        method: 'POST',
        url: '/transactions/transferOrders',
        baseURL: client.defaults.baseURL,
        headers: client.defaults.headers as Record<string, string>,
        data: {
          stokRef: Number(materialLogicalref),
          miktar: quantity,
          tarih: today,
        },
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<
    Array<{
      erpOrderId: string;
      orderRef: string;
      totalAmount: number;
      createdAt: string;
    }>
  > {
    const client = this.getClient(credentials);
    const dateFilter = since
      ? since.toISOString().slice(0, 10)
      : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const data = await axiosWithRetry<LogoOrdersResponse>(
      {
        method: 'GET',
        url: '/orders',
        baseURL: client.defaults.baseURL,
        headers: client.defaults.headers as Record<string, string>,
        params: {
          '$filter': `date ge ${dateFilter}`,
          '$top': 50,
        },
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );
    return data.value.map((row) => ({
      erpOrderId: String(row.logicalref),
      orderRef: row.ficheno ?? String(row.logicalref),
      totalAmount: Number(row.total ?? 0),
      createdAt: row.date ?? new Date().toISOString(),
    }));
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = this.getClient(credentials);
    const today = new Date().toISOString().slice(0, 10);
    const data = await axiosWithRetry<Record<string, unknown>>(
      {
        method: 'POST',
        url: '/invoices',
        baseURL: client.defaults.baseURL,
        headers: client.defaults.headers as Record<string, string>,
        data: {
          reference: invoice.orderRef,
          currency: invoice.currency,
          totalAmount: invoice.totalAmount,
          issueDate: today,
          lines: invoice.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            lineTotal: line.total,
          })),
        },
        timeout: 30_000,
      },
      { maxRetries: 2 },
    );

    const id =
      (isRecord(data) && typeof data.id === 'string' && data.id) ||
      (isRecord(data) && typeof data.invoiceId === 'string' && data.invoiceId) ||
      'unknown';
    const number =
      (isRecord(data) && typeof data.invoiceNumber === 'string' && data.invoiceNumber) ||
      (isRecord(data) && typeof data.number === 'string' && data.number) ||
      id;

    return {
      erpInvoiceId: id,
      orderRef: invoice.orderRef,
      invoiceNumber: number,
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
    const orders = await this.getOrders(credentials, since);
    return orders.map((order) => ({
      erpInvoiceId: order.erpOrderId,
      orderRef: order.orderRef,
      invoiceNumber: order.orderRef,
      totalAmount: order.totalAmount,
      currency: 'TRY',
      issuedAt: order.createdAt.split('T')[0],
      lines: [],
    }));
  }
}
