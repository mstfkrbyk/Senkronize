import { Injectable } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';

import { TsoftAdapter } from '../tsoft/tsoft.adapter';

/** T-Soft ERP yüzü — pazaryeri adaptöründen ayrı bağlantı testi dönüş tipi */
@Injectable()
export class TsoftErpAdapter implements IErpAdapter {
  readonly erpType = 'TSOFT';

  constructor(private readonly tsoft: TsoftAdapter) {}

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    const success = await this.tsoft.testConnection(credentials);
    return { success };
  }

  getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    return this.tsoft.getProducts(credentials);
  }

  createInvoice(
    credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    return this.tsoft.createInvoice(credentials, invoice);
  }

  getInvoices(credentials: Record<string, string>, since?: Date): Promise<ErpInvoice[]> {
    return this.tsoft.getInvoices(credentials, since);
  }
}
