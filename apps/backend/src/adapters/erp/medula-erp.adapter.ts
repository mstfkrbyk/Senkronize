import { Injectable, Logger } from '@nestjs/common';
import type { ERPConnectionResult, ErpInvoice, ErpProduct, IErpAdapter } from '@senkronize/shared';

import type { ErpInventoryPushItem, ErpOrder } from './erp-adapter.types';
import { stubInvoice } from './erp-adapter.utils';

/**
 * Medula — SGK eczane bağlantısı stub; resmi API entegrasyonu sonraki fazda genişletilir.
 */
@Injectable()
export class MedulaErpAdapter implements IErpAdapter {
  readonly erpType = 'MEDULA';
  private readonly logger = new Logger(MedulaErpAdapter.name);

  async testConnection(credentials: Record<string, string>): Promise<ERPConnectionResult> {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      return { success: false };
    }
    this.logger.warn('Medula bağlantı testi (stub) — SGK API köprüsü henüz aktif değil');
    return { success: true };
  }

  async getProducts(_credentials: Record<string, string>): Promise<ErpProduct[]> {
    return [];
  }

  async pushInventory(
    _credentials: Record<string, string>,
    _items: ErpInventoryPushItem[],
  ): Promise<void> {
    this.logger.warn('Medula stok güncelleme (stub)');
  }

  async getOrders(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpOrder[]> {
    return [];
  }

  async createInvoice(
    _credentials: Record<string, string>,
    invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    return stubInvoice(invoice);
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}
