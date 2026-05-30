import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosError } from 'axios';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  ErpProductImportOptions,
  IErpAdapter,
} from '@senkronize/shared';

import { axiosWithRetry, type RetryOptions } from '../../../common/utils/http-retry';
import {
  formatInvoiceDate,
  orderToInvoiceLines,
  type ErpOrderForInvoice,
} from '../../../common/erp/erp-invoice.helper';
import type { ErpStockCapableAdapter } from '../../../jobs/erp-sync.helpers';
import { runErpConnectionTest } from '../erp-adapter.utils';

import {
  BIZIMHESAP_BASE_URL,
  BIZIMHESAP_DEFAULT_VAT_RATE,
  BIZIMHESAP_FIXED_KEY,
} from './bizimhesap.constants';
import { resolveBizimHesapProductsArray } from './bizimhesap-product.util';
import { filterBizimHesapProductRows } from './bizimhesap-product-filter.util';
import { resolveBizimHesapProductName } from './bizimhesap-product-name.util';
import {
  resolveBizimHesapBarcode,
  resolveBizimHesapProductId,
  resolveBizimHesapSku,
} from './bizimhesap-product-identifiers.util';
import type {
  BizimHesapAddInvoiceResponse,
  BizimHesapProductRow,
  BizimHesapProductsResponse,
  BizimHesapWarehouseRow,
} from './bizimhesap.types';
import { BizimHesapRateLimitService } from './bizimhesap-rate-limit.service';

/** Senkron işleri: 429 yeniden deneme yok — kota tüketimini önler */
const BIZIMHESAP_SYNC_RETRY: RetryOptions = {
  maxRetries: 1,
  backoffMs: 1_000,
  retryOn: [500, 502, 503, 504],
};

function resolveToken(credentials: Record<string, string>): string {
  const token =
    credentials.token?.trim() ||
    credentials.apiKey?.trim() ||
    credentials.firmId?.trim();
  if (!token) {
    throw new Error('BizimHesap: token zorunludur');
  }
  return token;
}

function resolveProductId(row: BizimHesapProductRow): string {
  return resolveBizimHesapProductId(row);
}

function resolveProductName(row: BizimHesapProductRow): string {
  const barcode = resolveBizimHesapBarcode(row);
  const sku = resolveBizimHesapSku(row);
  return resolveBizimHesapProductName(row, barcode || sku || resolveProductId(row));
}

function resolveProductStock(row: BizimHesapProductRow): number {
  return Math.max(
    0,
    Math.round(
      Number(
        row.StockQuantity ??
          row.stock_quantity ??
          row.stockQuantity ??
          row.quantity ??
          0,
      ),
    ),
  );
}

@Injectable()
export class BizimHesapErpAdapter implements IErpAdapter, ErpStockCapableAdapter {
  readonly erpType = 'BIZIMHESAP';
  private readonly logger = new Logger(BizimHesapErpAdapter.name);

  constructor(private readonly rateLimit: BizimHesapRateLimitService) {}

  private buildHeaders(credentials: Record<string, string>): Record<string, string> {
    return {
      Key: BIZIMHESAP_FIXED_KEY,
      Token: resolveToken(credentials),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    credentials: Record<string, string>,
    body?: unknown,
    params?: Record<string, string | number>,
    retryOptions?: RetryOptions,
    organizationId?: string,
  ): Promise<T> {
    if (organizationId) {
      await this.rateLimit.assertCanRequest(organizationId);
    }
    try {
      const data = await axiosWithRetry<T>(
        {
          method,
          url: path,
          baseURL: BIZIMHESAP_BASE_URL,
          headers: this.buildHeaders(credentials),
          data: body,
          params,
          timeout: 30_000,
        },
        retryOptions ?? { maxRetries: 1, retryOn: [500, 502, 503, 504] },
      );
      if (organizationId) {
        await this.rateLimit.recordSuccessfulRequest(organizationId, path, method);
      }
      return data;
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status === 429 && organizationId) {
        await this.rateLimit.record429(organizationId, error, path, method);
      }
      throw error;
    }
  }

  async testConnection(
    credentials: Record<string, string>,
    _organizationId?: string,
  ): Promise<ERPConnectionResult> {
    // BizimHesap saatlik ~10 istek kotası var; canlı API testi sync kotasını tüketir.
    return runErpConnectionTest(async () => {
      resolveToken(credentials);
      return {
        companyName: credentials.companyName?.trim() || undefined,
        version: 'b2b-local',
      };
    });
  }

  async getProducts(
    credentials: Record<string, string>,
    options?: ErpProductImportOptions,
    organizationId?: string,
  ): Promise<ErpProduct[]> {
    const response = await this.request<BizimHesapProductsResponse>(
      'GET',
      '/products',
      credentials,
      undefined,
      undefined,
      BIZIMHESAP_SYNC_RETRY,
      organizationId,
    );
    const rows = filterBizimHesapProductRows(
      resolveBizimHesapProductsArray(response),
      options,
    );
    const out: ErpProduct[] = [];

    for (const row of rows) {
      const erpProductId = resolveProductId(row);
      if (!erpProductId) {
        continue;
      }
      out.push({
        erpProductId,
        barcode: resolveBizimHesapBarcode(row),
        sku: resolveBizimHesapSku(row),
        name: resolveProductName(row),
        stockQuantity: resolveProductStock(row),
        purchasePrice:
          Number(row.PurchasePrice ?? row.purchase_price ?? row.purchasePrice ?? 0) || undefined,
      });
    }

    return out;
  }

  async updateStock(
    credentials: Record<string, string>,
    _productId: string,
    _stockQuantity: number,
  ): Promise<void> {
    // BizimHesap B2B API'si doğrudan stok güncelleme endpointi sunmamaktadır.
    // Stok senkronizasyonu fatura/sipariş akışı üzerinden gerçekleşir.
    this.logger.warn('BizimHesap B2B API stok doğrudan güncellenemiyor; fatura akışı kullanın');
  }

  async pushInvoice(
    credentials: Record<string, string>,
    order: ErpOrderForInvoice,
  ): Promise<string> {
    const lines = orderToInvoiceLines(order);
    const invoice = await this.createInvoice(credentials, {
      orderRef: order.externalId ?? 'sipariş',
      customerName: order.customer?.name ?? 'Perakende Müşteri',
      totalAmount: lines.reduce((s, l) => s + l.total, 0),
      currency: order.currency ?? 'TRY',
      lines,
    });
    return invoice.erpInvoiceId;
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
    organizationId?: string,
  ): Promise<ErpInvoice> {
    const today = formatInvoiceDate(new Date());
    const firmId = resolveToken(credentials);
    const vatRate = BIZIMHESAP_DEFAULT_VAT_RATE;

    const details = invoice.lines.map((line) => {
      const net = Math.round(line.quantity * line.unitPrice * 100) / 100;
      const tax = Math.round(net * (vatRate / 100) * 100) / 100;
      const total = Math.round((net + tax) * 100) / 100;
      return {
        ProductId: line.sku ?? '',
        ProductName: line.description,
        TaxRate: String(vatRate),
        Quantity: line.quantity,
        UnitPrice: String(line.unitPrice),
        GrossPrice: String(net),
        Discount: '0',
        Net: String(net),
        Tax: String(tax),
        Total: String(total),
      };
    });

    const gross = details.reduce((s, d) => s + Number(d.GrossPrice), 0);
    const taxTotal = details.reduce((s, d) => s + Number(d.Tax), 0);
    const total = details.reduce((s, d) => s + Number(d.Total), 0);

    const body = {
      firmId,
      invoiceNo: invoice.orderRef,
      invoiceType: 3,
      note: `Senkronize — Sipariş: ${invoice.orderRef}`,
      dates: {
        invoiceDate: today,
        dueDate: today,
      },
      customer: {
        title: invoice.customerName ?? 'Perakende',
        address: '',
      },
      amounts: {
        currency: invoice.currency === 'TRY' ? 'TL' : (invoice.currency ?? 'TL'),
        gross: String(gross),
        discount: '0',
        net: String(gross),
        tax: String(taxTotal),
        total: String(total),
      },
      details: details.map((line) => ({
        productId: line.ProductId,
        productName: line.ProductName,
        taxRate: line.TaxRate,
        quantity: line.Quantity,
        unitPrice: line.UnitPrice,
        grossPrice: line.GrossPrice,
        discount: line.Discount,
        net: line.Net,
        tax: line.Tax,
        total: line.Total,
      })),
    };

    const response = await this.request<BizimHesapAddInvoiceResponse>(
      'POST',
      '/addinvoice',
      credentials,
      body,
      undefined,
      undefined,
      organizationId,
    );

    if (response.error) {
      throw new Error(`BizimHesap fatura hatası: ${response.error}`);
    }

    return {
      erpInvoiceId: response.guid,
      orderRef: invoice.orderRef,
      invoiceNumber: invoice.orderRef,
      totalAmount: total,
      currency: invoice.currency,
      issuedAt: today,
      lines: invoice.lines,
    };
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    // BizimHesap B2B API'si fatura listeleme endpointi sunmamaktadır.
    return [];
  }

  async getWarehouses(
    credentials: Record<string, string>,
    organizationId?: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const response = await this.request<unknown>(
      'GET',
      '/warehouses',
      credentials,
      undefined,
      undefined,
      undefined,
      organizationId,
    );
    const rows = resolveBizimHesapProductsArray(response) as Array<
      BizimHesapWarehouseRow & { id?: string; name?: string }
    >;
    return rows.map((r) => ({
      id: String(r.Id ?? r.id ?? '').trim(),
      name: String(r.Name ?? r.name ?? 'Depo').trim(),
    })).filter((r) => r.id.length > 0);
  }
}
