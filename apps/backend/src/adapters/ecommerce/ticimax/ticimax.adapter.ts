import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { EcommerceType } from '@prisma/client';
import type {
  IEcommerceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  mapTicimaxStatus,
  toMarketplaceOrder,
  type NormalizedOrder,
} from '../../common/order-normalizer';
import {
  formatTicimaxSoapError,
  normalizeTicimaxCredentials,
  TicimaxSoapClient,
} from '../../ticimax/ticimax-soap.util';
import { applyTicimaxStockUpdates } from '../../ticimax/ticimax-stock-update.util';

import type { TicimaxCargoPayload, TicimaxWebhookPayload } from './ticimax.types';

const PAGE_SIZE = 100;

@Injectable()
export class TicimaxEcommerceAdapter implements IEcommerceAdapter {
  readonly platform = 'TICIMAX';
  private readonly logger = new Logger(TicimaxEcommerceAdapter.name);

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
      return [];
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
          PAGE_SIZE,
        );
        for (const order of batch) {
          const normalized: NormalizedOrder = {
            externalId: order.id,
            externalOrderNo: order.orderNo,
            platform: EcommerceType.TICIMAX,
            rawStatus: order.status,
            status: mapTicimaxStatus(order.status),
            customer: {
              name: order.customerName,
              email: order.customerEmail ?? '',
              phone: order.customerPhone,
            },
            shippingAddress: {
              line1: order.shippingAddress ?? '',
              city: '',
              country: 'TR',
            },
            items: order.items.map((item) => ({
              sku: item.sku,
              name: item.name,
              qty: item.quantity,
              unitPrice: item.unitPrice,
            })),
            totalAmount: order.totalAmount,
            currency: 'TRY',
            createdAt: new Date(order.createdAt),
          };
          all.push(toMarketplaceOrder(normalized));
        }
        if (batch.length < PAGE_SIZE) {
          break;
        }
        index += batch.length;
      } catch (error) {
        this.logger.warn('Ticimax sipariş listesi alınamadı', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        break;
      }
    }
    return all;
  }

  async getOrderById(
    credentials: Record<string, string>,
    orderId: string,
  ): Promise<NormalizedOrder | null> {
    const orders = await this.getOrders(
      credentials,
      new Date(Date.now() - 365 * 86_400_000),
    );
    const match = orders.find(
      (order) => order.platformOrderId === orderId,
    );
    if (!match) {
      return null;
    }
    return {
      externalId: match.platformOrderId,
      externalOrderNo: match.platformOrderId,
      platform: EcommerceType.TICIMAX,
      rawStatus: match.status,
      status: mapTicimaxStatus(match.status),
      customer: {
        name: match.customerName,
        email: match.customerEmail ?? '',
        phone: match.customerPhone,
      },
      shippingAddress: {
        line1: match.shippingAddress ?? '',
        city: '',
        country: 'TR',
      },
      items: match.items.map((item) => ({
        sku: item.sku,
        name: item.productName ?? item.sku,
        qty: item.quantity,
        unitPrice: item.unitPrice,
      })),
      totalAmount: match.totalAmount,
      currency: match.currency,
      createdAt: new Date(match.createdAt),
    };
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const client = this.getClient(credentials);
    if (!client) {
      throw new Error('Ticimax bağlantı bilgileri eksik veya geçersiz');
    }
    const products = await client.selectProducts(page * PAGE_SIZE, PAGE_SIZE);
    const items: MarketplaceListing[] = products.map((product) => ({
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
    return {
      items,
      total: page * PAGE_SIZE + items.length,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const client = this.getClient(credentials);
    if (!client) {
      throw new Error('Ticimax bağlantı bilgileri eksik veya geçersiz');
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

  async updateOrderCargo(
    _credentials: Record<string, string>,
    _orderNo: string,
    _payload: TicimaxCargoPayload,
  ): Promise<void> {
    throw new NotImplementedException(
      'Ticimax kargo güncelleme henüz desteklenmiyor',
    );
  }

  async registerWebhook(
    _credentials: Record<string, string>,
    _webhookUrl: string,
    _type = 'order_created',
  ): Promise<void> {
    throw new NotImplementedException(
      'Ticimax webhook kaydı bu entegrasyonda desteklenmiyor',
    );
  }
}
