import { Buffer } from 'node:buffer';

import { Injectable, Logger } from '@nestjs/common';
import type { AxiosRequestConfig } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';
import { parseMoney, throwSyncFailed } from '../stub-helpers';
import { RAKUTEN_API_BASE } from './rakuten.constants';
import type {
  RakutenGetOrderResponse,
  RakutenOrderLine,
  RakutenOrderModel,
  RakutenSearchOrderResponse,
} from './rakuten.types';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRakutenDatetime(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

@Injectable()
export class RakutenAdapter implements IMarketplaceAdapter {
  readonly platform = 'RAKUTEN';
  private readonly logger = new Logger(RakutenAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.RAKUTEN ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private resolveCredentials(credentials: Record<string, string>): {
    serviceSecret: string;
    licenseKey: string;
  } {
    const serviceSecret = credentials.serviceSecret?.trim() ?? '';
    const licenseKey = credentials.licenseKey?.trim() ?? '';
    if (!serviceSecret || !licenseKey) {
      throw new Error('Rakuten: serviceSecret ve licenseKey zorunludur');
    }
    return { serviceSecret, licenseKey };
  }

  private auth(credentials: Record<string, string>): Pick<AxiosRequestConfig, 'headers'> {
    const { serviceSecret, licenseKey } = this.resolveCredentials(credentials);
    const basic = Buffer.from(`${serviceSecret}:${licenseKey}`, 'utf8').toString(
      'base64',
    );
    return {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/xml; charset=utf-8',
        Accept: 'application/xml',
      },
    };
  }

  private buildUpdateItemXml(itemNumber: string, quantity: number): string {
    const sku = escapeXml(itemNumber);
    const qty = Math.max(0, Math.round(quantity));
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <itemUpdateRequest>
    <item>
      <itemNumber>${sku}</itemNumber>
      <inventoryUpdateFlag>1</inventoryUpdateFlag>
      <inventoryNum>${String(qty)}</inventoryNum>
    </item>
  </itemUpdateRequest>
</request>`;
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 86400000);
      await withRateLimit('RAKUTEN', this.rpm(), async () => {
        await axiosWithRetry<RakutenSearchOrderResponse>(
          {
            method: 'GET',
            url: `${RAKUTEN_API_BASE}/order/searchOrder/`,
            timeout: 12_000,
            params: {
              dateType: 1,
              startDatetime: formatRakutenDatetime(start),
              endDatetime: formatRakutenDatetime(end),
            },
            ...this.auth(credentials),
          },
          { maxRetries: 1 },
        );
      });
      return true;
    } catch (error) {
      this.logger.warn('Rakuten bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private collectLines(order: RakutenOrderModel): RakutenOrderLine[] {
    const direct = Array.isArray(order.ItemModelList) ? order.ItemModelList : [];
    if (direct.length > 0) {
      return direct;
    }
    const fromPkg: RakutenOrderLine[] = [];
    const pkgs = Array.isArray(order.PackageModelList)
      ? order.PackageModelList
      : [];
    for (const pkg of pkgs) {
      const items = Array.isArray(pkg.ItemModelList) ? pkg.ItemModelList : [];
      fromPkg.push(...items);
    }
    return fromPkg;
  }

  private mapOrder(row: RakutenOrderModel): MarketplaceOrder | null {
    const idRaw = row.orderNumber;
    if (typeof idRaw !== 'string' || idRaw.length === 0) {
      return null;
    }
    const lines = this.collectLines(row);
    const createdRaw = row.orderDatetime;
    const customerName =
      typeof row.ordererName === 'string' && row.ordererName.length > 0
        ? row.ordererName
        : '—';
    return {
      platformOrderId: idRaw,
      status:
        typeof row.orderStatus === 'string' ? row.orderStatus : 'UNKNOWN',
      customerName,
      items: lines.map((l) => {
        const sku =
          typeof l.itemNumber === 'string' ? l.itemNumber : '';
        const qty =
          typeof l.units === 'number' && Number.isFinite(l.units)
            ? Math.max(0, Math.round(l.units))
            : 0;
        return {
          sku,
          barcode: sku,
          quantity: qty,
          unitPrice: parseMoney(l.price),
          platformItemId: sku,
          productName:
            typeof l.itemName === 'string' ? l.itemName : undefined,
        };
      }),
      totalAmount: parseMoney(row.totalPrice),
      currency: 'JPY',
      createdAt:
        typeof createdRaw === 'string' && createdRaw.length > 0
          ? new Date(createdRaw).toISOString()
          : new Date().toISOString(),
    };
  }

  async getOrderByNumber(
    credentials: Record<string, string>,
    orderNumber: string,
  ): Promise<RakutenOrderModel | null> {
    try {
      const data = await withRateLimit('RAKUTEN', this.rpm(), async () => {
        return await axiosWithRetry<RakutenGetOrderResponse>(
          {
            method: 'GET',
            url: `${RAKUTEN_API_BASE}/order/getOrder/`,
            timeout: 20_000,
            params: { orderNumberList: orderNumber },
            ...this.auth(credentials),
          },
          { maxRetries: 1 },
        );
      });
      const list = Array.isArray(data.OrderModelList) ? data.OrderModelList : [];
      return list[0] ?? null;
    } catch (error) {
      this.logger.warn('Rakuten sipariş detayı alınamadı', {
        orderNumber,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return null;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const end = new Date();
      const start = since ?? new Date(end.getTime() - 7 * 86400000);
      const data = await withRateLimit('RAKUTEN', this.rpm(), async () => {
        return await axiosWithRetry<RakutenSearchOrderResponse>(
          {
            method: 'GET',
            url: `${RAKUTEN_API_BASE}/order/searchOrder/`,
            timeout: 25_000,
            params: {
              dateType: 1,
              startDatetime: formatRakutenDatetime(start),
              endDatetime: formatRakutenDatetime(end),
            },
            ...this.auth(credentials),
          },
          {},
        );
      });
      const orders = Array.isArray(data.OrderModelList)
        ? data.OrderModelList
        : [];
      if (orders.length > 0) {
        return orders
          .map((o) => this.mapOrder(o))
          .filter((x): x is MarketplaceOrder => x !== null);
      }
      const numbers = Array.isArray(data.orderNumberList)
        ? data.orderNumberList
        : [];
      const all: MarketplaceOrder[] = [];
      for (const orderNumber of numbers) {
        if (typeof orderNumber !== 'string' || orderNumber.length === 0) {
          continue;
        }
        const detail = await this.getOrderByNumber(credentials, orderNumber);
        if (detail) {
          const mapped = this.mapOrder(detail);
          if (mapped) {
            all.push(mapped);
          }
        }
      }
      return all;
    } catch (error) {
      throwSyncFailed('RAKUTEN', 'getOrders', error);
    }
  }

  async getListings(
    _credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    return {
      items: [],
      total: 0,
      page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      await withRateLimit('RAKUTEN', this.rpm(), async () => {
        for (const u of updates) {
          const xml = this.buildUpdateItemXml(u.barcode.trim(), u.quantity);
          await axiosWithRetry<string>(
            {
              method: 'POST',
              url: `${RAKUTEN_API_BASE}/item/updateItem/`,
              timeout: 25_000,
              data: xml,
              ...this.auth(credentials),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('RAKUTEN', 'updateStock', error);
    }
  }

  async updatePrice(
    _credentials: Record<string, string>,
    _updates: PriceUpdatePayload[],
  ): Promise<void> {
    throwSyncFailed(
      'RAKUTEN',
      'updatePrice',
      new Error('Rakuten RMS: fiyat güncelleme bu adaptörde desteklenmiyor'),
    );
  }
}
