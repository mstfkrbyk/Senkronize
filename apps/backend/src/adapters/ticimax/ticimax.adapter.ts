import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import type {
  ErpInvoice,
  ErpProduct,
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  formatTicimaxSoapError,
  normalizeTicimaxCredentials,
  TicimaxSoapClient,
} from './ticimax-soap.util';
import { applyTicimaxStockUpdates } from './ticimax-stock-update.util';

const DEFAULT_LIST_PAGE_SIZE = 50;
const MAX_PRODUCT_PAGES = 80;

@Injectable()
export class TicimaxAdapter implements IMarketplaceAdapter {
  readonly platform = 'TICIMAX';
  readonly erpType = 'TICIMAX';
  private readonly logger = new Logger(TicimaxAdapter.name);

  private getClient(
    credentials: Record<string, string>,
  ): TicimaxSoapClient | null {
    const config = normalizeTicimaxCredentials(credentials);
    if (!config) {
      return null;
    }
    return new TicimaxSoapClient(config);
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    const client = this.getClient(credentials);
    if (!client) {
      return false;
    }
    try {
      return await client.testConnection();
    } catch (error) {
      this.logger.warn('Ticimax bağlantı testi başarısız', {
        error: formatTicimaxSoapError(error),
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const client = this.getClient(credentials);
    if (!client) {
      throw new Error(
        'Ticimax kimlik bilgileri eksik. Mağaza URL ve Üye Kodu alanlarını kontrol edin.',
      );
    }
    const sinceDate = since ?? new Date(Date.now() - 7 * 86_400_000);
    const untilDate = new Date();
    const all: MarketplaceOrder[] = [];
    let index = 0;
    let guard = 0;
    while (guard < 50) {
      guard += 1;
      try {
        const batch = await client.selectOrders(
          sinceDate,
          untilDate,
          index,
          100,
        );
        for (const order of batch) {
          all.push({
            platformOrderId: order.id,
            status: order.status,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            shippingAddress: order.shippingAddress,
            items: order.items.map((item, idx) => ({
              sku: item.sku,
              barcode: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              platformItemId: `${order.id}-${idx}`,
              productName: item.name,
            })),
            totalAmount: order.totalAmount,
            currency: 'TRY',
            createdAt: order.createdAt,
          });
        }
        if (batch.length < 100) {
          break;
        }
        index += batch.length;
      } catch (error) {
        this.logger.warn('Ticimax sipariş listesi alınamadı', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        throw error;
      }
    }
    return all;
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const client = this.getClient(credentials);
    if (!client) {
      throw new Error(
        'Ticimax kimlik bilgileri eksik. Mağaza URL ve Üye Kodu alanlarını kontrol edin.',
      );
    }
    try {
      const itemsRaw = await client.selectProducts(
        page * DEFAULT_LIST_PAGE_SIZE,
        DEFAULT_LIST_PAGE_SIZE,
      );
      const items: MarketplaceListing[] = itemsRaw.map((product) => ({
        platformProductId: product.id,
        barcode: product.barcode,
        platformSku:
          product.sku.length > 0 && product.sku !== product.barcode
            ? product.sku
            : undefined,
        title: product.name,
        quantity: product.stockQuantity,
        salePrice: product.salePrice,
        listPrice: product.listPrice,
        approved: product.active,
        images: [],
      }));
      const hasMorePages = items.length >= DEFAULT_LIST_PAGE_SIZE;
      return {
        items,
        total: hasMorePages
          ? (page + 1) * DEFAULT_LIST_PAGE_SIZE + 1
          : page * DEFAULT_LIST_PAGE_SIZE + items.length,
        page,
        pageSize: DEFAULT_LIST_PAGE_SIZE,
      };
    } catch (error) {
      this.logger.warn('Ticimax ürün listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      throw error;
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    if (!client) {
      throw new Error(
        'Ticimax kimlik bilgileri eksik. Mağaza URL ve Üye Kodu alanlarını kontrol edin.',
      );
    }
    try {
      await applyTicimaxStockUpdates(client, updates, this.logger);
    } catch (error) {
      const message = formatTicimaxSoapError(error);
      this.logger.warn('Ticimax stok güncelleme başarısız', { error: message });
      throw new Error(message);
    }
  }

  async updatePrice(
    _credentials: Record<string, string>,
    _updates: PriceUpdatePayload[],
  ): Promise<void> {
    throw new NotImplementedException(
      'Ticimax fiyat güncelleme SOAP SaveUrun ile henüz desteklenmiyor',
    );
  }

  async getProducts(credentials: Record<string, string>): Promise<ErpProduct[]> {
    const all: ErpProduct[] = [];
    let page = 0;
    let guard = 0;
    while (guard < MAX_PRODUCT_PAGES) {
      guard += 1;
      const batch = await this.getListings(credentials, page);
      for (const listing of batch.items) {
        all.push({
          erpProductId: listing.platformProductId,
          barcode: listing.barcode,
          name: listing.title,
          stockQuantity: listing.quantity,
          purchasePrice: listing.listPrice,
        });
      }
      if (
        batch.items.length === 0 ||
        batch.items.length < batch.pageSize
      ) {
        break;
      }
      page += 1;
    }
    return all;
  }

  async createInvoice(
    _credentials: Record<string, string>,
    _invoice: Omit<ErpInvoice, 'erpInvoiceId' | 'invoiceNumber' | 'issuedAt'>,
  ): Promise<ErpInvoice> {
    throw new NotImplementedException(
      'Ticimax fatura oluşturma henüz desteklenmiyor',
    );
  }

  async getInvoices(
    _credentials: Record<string, string>,
    _since?: Date,
  ): Promise<ErpInvoice[]> {
    return [];
  }
}
