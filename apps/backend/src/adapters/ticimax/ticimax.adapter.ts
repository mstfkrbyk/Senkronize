import { Injectable, NotImplementedException } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';

@Injectable()
export class TicimaxAdapter implements IErpAdapter {
  readonly erpType = 'TICIMAX';

  async testConnection(): Promise<boolean> {
    return false;
  }

  async getProducts(): Promise<ErpProduct[]> {
    return [];
  }

  async createInvoice(): Promise<ErpInvoice> {
    throw new NotImplementedException('Ticimax yakında');
  }

  async getInvoices(): Promise<ErpInvoice[]> {
    return [];
  }
}
