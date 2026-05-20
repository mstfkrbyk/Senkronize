import { Injectable } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';

import { TicimaxAdapter } from '../ticimax/ticimax.adapter';

/** Ticimax ERP yüzü — pazaryeri adaptöründen ayrı bağlantı testi dönüş tipi */
@Injectable()
export class TicimaxErpAdapter implements IErpAdapter {
  readonly erpType = 'TICIMAX';

  constructor(private readonly ticimax: TicimaxAdapter) {}

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    const success = await this.ticimax.testConnection(credentials);
    return { success };
  }

  getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    return this.ticimax.getProducts(credentials);
  }

  createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    return this.ticimax.createInvoice(credentials, invoice);
  }

  getInvoices(credentials: Record<string, string>, since?: Date): Promise<ErpInvoice[]> {
    return this.ticimax.getInvoices(credentials, since);
  }
}
