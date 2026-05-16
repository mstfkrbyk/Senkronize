import { Injectable, NotImplementedException } from '@nestjs/common';
import type { ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';

@Injectable()
export class TsoftAdapter implements IErpAdapter {
  readonly erpType = 'TSOFT';

  async testConnection(): Promise<boolean> {
    return false;
  }

  async getProducts(): Promise<ErpProduct[]> {
    return [];
  }

  async createInvoice(): Promise<ErpInvoice> {
    throw new NotImplementedException('T-Soft yakında');
  }

  async getInvoices(): Promise<ErpInvoice[]> {
    return [];
  }
}
