import { Injectable } from '@nestjs/common';
import type {
  ERPConnectionResult,
  ErpInvoice,
  ErpProduct,
  IErpAdapter,
} from '@senkronize/shared';

import {
  formatTicimaxSoapError,
  normalizeTicimaxCredentials,
  TicimaxSoapClient,
} from '../ticimax/ticimax-soap.util';
import { TicimaxAdapter } from '../ticimax/ticimax.adapter';

/** Ticimax ERP yüzü — SOAP webservis (UrunServis / SiparisServis) */
@Injectable()
export class TicimaxErpAdapter implements IErpAdapter {
  readonly erpType = 'TICIMAX';

  constructor(private readonly ticimax: TicimaxAdapter) {}

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    const config = normalizeTicimaxCredentials(credentials);
    if (!config) {
      return {
        success: false,
        message: 'Ticimax: Mağaza URL ve Üye Kodu zorunludur.',
      };
    }
    try {
      const detail = await new TicimaxSoapClient(config).testConnectionDetailed();
      return {
        success: true,
        version: 'webservis',
        productCount: detail.productCount,
      };
    } catch (error) {
      return {
        success: false,
        message: formatTicimaxSoapError(error),
      };
    }
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
