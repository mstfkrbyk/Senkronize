import { Injectable, Logger } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';
import axios, { type AxiosInstance } from 'axios';

import {
  erpInvoiceLinesToApiLines,
  formatInvoiceDate,
  invoiceDueDate,
  orderToInvoiceLines,
  type ErpOrderCustomer,
  type ErpOrderForInvoice,
} from '../../../common/erp/erp-invoice.helper';
import type { ErpStockCapableAdapter } from '../../../jobs/erp-sync.helpers';
import { parseJsonApi, runErpConnectionTest, type JsonApiResource } from '../erp-adapter.utils';

import {
  PARASUT_BASE_URL,
  PARASUT_DEFAULT_VAT_RATE,
  PARASUT_PAGE_SIZE,
} from './parasut.constants';
import { ParasutOAuthService } from './parasut.oauth';
import type {
  ParasutContactAttributes,
  ParasutInvoiceAttributes,
  ParasutJsonApiList,
  ParasutJsonApiSingle,
  ParasutMeResponse,
  ParasutProductAttributes,
} from './parasut.types';

@Injectable()
export class ParasutErpAdapter implements IErpAdapter, ErpStockCapableAdapter {
  readonly erpType = 'PARASUT';
  private readonly logger = new Logger(ParasutErpAdapter.name);

  constructor(private readonly oauth: ParasutOAuthService) {}

  private async getClient(credentials: Record<string, string>): Promise<AxiosInstance> {
    const companyId = credentials.companyId?.trim();
    if (!companyId) {
      throw new Error('Paraşüt: companyId zorunludur');
    }
    const token = await this.oauth.getAccessToken(credentials);
    return axios.create({
      baseURL: `${PARASUT_BASE_URL}/${companyId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    const result = await runErpConnectionTest(async () => {
      const client = await this.getClient(credentials);
      const { data: meData } = await client.get<ParasutMeResponse>('/me');
      const { data: productsData } = await client.get<ParasutJsonApiList<ParasutProductAttributes>>(
        '/products',
        { params: { 'page[size]': 1, 'page[number]': 1 } },
      );
      return {
        companyName: meData.data.attributes.name,
        version: 'v4',
        productCount: productsData.meta?.total_count ?? productsData.data.length,
      };
    });
    if (!result.success) {
      this.logger.warn('Paraşüt bağlantı testi başarısız', {
        error: result.message,
      });
    }
    return result;
  }

  async getProducts(
    credentials: Record<string, string>,
    search?: string,
  ): Promise<ErpProduct[]> {
    const client = await this.getClient(credentials);
    const out: ErpProduct[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params: Record<string, string | number> = {
        'page[size]': PARASUT_PAGE_SIZE,
        'page[number]': page,
      };
      if (search?.trim()) {
        params['filter[name]'] = search.trim();
      }
      const { data } = await client.get<ParasutJsonApiList<ParasutProductAttributes>>('/products', {
        params,
      });
      const rows = parseJsonApi<ParasutProductAttributes>({
        data: data.data as unknown as JsonApiResource[],
      });
      for (const p of rows) {
        const stockCount = p.stock_count ?? p.initial_stock_count ?? 0;
        out.push({
          erpProductId: p.id,
          barcode: (p.code ?? p.id).trim(),
          name: p.name.trim(),
          stockQuantity: Math.max(0, Math.round(Number(stockCount))),
          purchasePrice: p.purchase_price,
        });
      }
      totalPages = data.meta?.total_pages ?? 1;
      page += 1;
    } while (page <= totalPages && page <= 100);

    return out;
  }

  async syncProducts(credentials: Record<string, string>, products: ErpProduct[]): Promise<void> {
    const client = await this.getClient(credentials);
    for (const product of products) {
      try {
        await client.post('/products', {
          data: {
            type: 'products',
            attributes: {
              name: product.name,
              code: product.barcode,
              inventory_tracking: true,
              initial_stock_count: product.stockQuantity,
              vat_rate: PARASUT_DEFAULT_VAT_RATE,
              purchase_price: product.purchasePrice,
            },
          },
        });
      } catch (error) {
        this.logger.warn('Paraşüt ürün senkronu başarısız', {
          barcode: product.barcode,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    productId: string,
    quantity: number,
    description = 'Senkronize',
  ): Promise<void> {
    const client = await this.getClient(credentials);
    await client.post('/stock_movements', {
      data: {
        type: 'stock_movements',
        attributes: { quantity, description },
        relationships: {
          stockable: { data: { id: productId, type: 'products' } },
        },
      },
    });
  }

  async findOrCreateContact(
    credentials: Record<string, string>,
    customer: ErpOrderCustomer,
  ): Promise<string> {
    const name = customer.name?.trim();
    if (!name) {
      return this.resolveContactId(credentials, 'müşteri');
    }

    const client = await this.getClient(credentials);
    const params: Record<string, string | number> = {
      'filter[name]': name,
      'page[size]': 5,
      'page[number]': 1,
    };
    if (customer.email?.trim()) {
      params['filter[email]'] = customer.email.trim();
    }

    const { data } = await client.get<ParasutJsonApiList<ParasutContactAttributes>>('/contacts', {
      params,
    });
    const rows = parseJsonApi<ParasutContactAttributes>({
      data: data.data as unknown as JsonApiResource[],
    });
    if (rows[0]?.id) {
      return rows[0].id;
    }

    const created = await this.createContact(credentials, {
      name,
      email: customer.email,
    });
    return created.id;
  }

  async getContacts(
    credentials: Record<string, string>,
    contactType: 'customer' | 'supplier' = 'customer',
    page = 1,
  ): Promise<Array<{ id: string; name: string }>> {
    const client = await this.getClient(credentials);
    const { data } = await client.get<ParasutJsonApiList<ParasutContactAttributes>>('/contacts', {
      params: {
        'filter[contact_type]': contactType,
        'page[size]': PARASUT_PAGE_SIZE,
        'page[number]': page,
      },
    });
    return parseJsonApi<ParasutContactAttributes>({
      data: data.data as unknown as JsonApiResource[],
    }).map((c) => ({
      id: c.id,
      name: c.name ?? c.email ?? c.id,
    }));
  }

  async createContact(
    credentials: Record<string, string>,
    contact: { name: string; email?: string },
  ): Promise<{ id: string; name: string }> {
    const client = await this.getClient(credentials);
    const { data } = await client.post<ParasutJsonApiSingle<ParasutContactAttributes>>('/contacts', {
      data: {
        type: 'contacts',
        attributes: {
          name: contact.name,
          email: contact.email,
          contact_type: 'customer',
        },
      },
    });
    return {
      id: data.data.id,
      name: data.data.attributes.name ?? contact.name,
    };
  }

  async pushInvoice(
    credentials: Record<string, string>,
    order: ErpOrderForInvoice,
  ): Promise<string> {
    const lines = orderToInvoiceLines(order);
    const totalAmount = lines.reduce((sum, line) => sum + line.total, 0);
    const invoice = await this.createInvoice(credentials, {
      orderRef: order.externalId ?? 'sipariş',
      customerName: order.customer?.name,
      totalAmount,
      currency: order.currency ?? 'TRL',
      lines,
    });
    return invoice.erpInvoiceId;
  }

  async createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    const client = await this.getClient(credentials);
    const issueDate = formatInvoiceDate(new Date());
    const dueDate = invoiceDueDate(new Date(), 7);
    const contactId = await this.resolveContactId(
      credentials,
      invoice.orderRef,
      invoice.customerName,
    );
    const apiLines = erpInvoiceLinesToApiLines(invoice.lines, PARASUT_DEFAULT_VAT_RATE);

    const body = {
      data: {
        type: 'sales_invoices',
        attributes: {
          item_type: 'invoice',
          description: `Sipariş #${invoice.orderRef}`,
          issue_date: issueDate,
          due_date: dueDate,
          currency: invoice.currency || 'TRL',
          net_total: invoice.totalAmount,
          gross_total: invoice.totalAmount,
          lines: apiLines.map((line) => ({
            quantity: line.quantity,
            unit_price: line.unit_price,
            vat_rate: line.vat_rate,
            description: line.description,
          })),
        },
        relationships: {
          contact: { data: { id: contactId, type: 'contacts' } },
        },
      },
    };

    const { data } = await client.post<ParasutJsonApiSingle<ParasutInvoiceAttributes>>(
      '/sales_invoices',
      body,
    );

    return {
      erpInvoiceId: data.data.id,
      orderRef: invoice.orderRef,
      invoiceNumber: data.data.attributes.invoice_no ?? data.data.id,
      totalAmount: data.data.attributes.gross_total ?? invoice.totalAmount,
      currency: data.data.attributes.currency,
      issuedAt: data.data.attributes.issue_date,
      lines: invoice.lines,
    };
  }

  async getSalesInvoice(
    credentials: Record<string, string>,
    invoiceId: string,
  ): Promise<ErpInvoice> {
    const client = await this.getClient(credentials);
    const { data } = await client.get<ParasutJsonApiSingle<ParasutInvoiceAttributes>>(
      `/sales_invoices/${invoiceId}`,
    );
    const inv = data.data;
    return {
      erpInvoiceId: inv.id,
      orderRef: inv.attributes.description ?? inv.id,
      invoiceNumber: inv.attributes.invoice_no ?? inv.id,
      totalAmount: inv.attributes.gross_total ?? 0,
      currency: inv.attributes.currency,
      issuedAt: inv.attributes.issue_date,
      lines: [],
    };
  }

  async getInvoices(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ErpInvoice[]> {
    const client = await this.getClient(credentials);
    const out: ErpInvoice[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params: Record<string, string | number> = {
        'page[size]': PARASUT_PAGE_SIZE,
        'page[number]': page,
      };
      if (since) {
        params['filter[issue_date_gte]'] = formatInvoiceDate(since);
      }
      const { data } = await client.get<ParasutJsonApiList<ParasutInvoiceAttributes>>(
        '/sales_invoices',
        { params },
      );

      const rows = parseJsonApi<ParasutInvoiceAttributes>({
        data: data.data as unknown as JsonApiResource[],
      });
      for (const inv of rows) {
        out.push({
          erpInvoiceId: inv.id,
          orderRef: inv.description ?? inv.id,
          invoiceNumber: inv.invoice_no ?? inv.id,
          totalAmount: inv.gross_total ?? 0,
          currency: inv.currency,
          issuedAt: inv.issue_date,
          lines: [],
        });
      }
      totalPages = data.meta?.total_pages ?? 1;
      page += 1;
    } while (page <= totalPages && page <= 100);

    return out;
  }

  private async resolveContactId(
    credentials: Record<string, string>,
    orderRef: string,
    customerName?: string,
  ): Promise<string> {
    const defaultId = credentials.defaultContactId?.trim();
    if (defaultId) {
      return defaultId;
    }
    if (customerName?.trim()) {
      return this.findOrCreateContact(credentials, { name: customerName.trim() });
    }
    const contacts = await this.getContacts(credentials);
    if (contacts[0]?.id) {
      return contacts[0].id;
    }
    const created = await this.createContact(credentials, {
      name: `Senkronize Müşteri (${orderRef})`,
    });
    return created.id;
  }
}
