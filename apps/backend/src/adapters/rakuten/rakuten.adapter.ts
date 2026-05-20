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
import {
  RAKUTEN_API_BASE,
  RAKUTEN_ORDER_PROGRESS_LIST,
  RAKUTEN_PAY_API_BASE,
} from './rakuten.constants';
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

/** Rakuten Pay API — Asia/Tokyo RFC3339 (+0900) */
function formatRakutenPayDatetime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+0900`;
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

  private esaAuth(
    credentials: Record<string, string>,
    contentType: string,
  ): Pick<AxiosRequestConfig, 'headers'> {
    const { serviceSecret, licenseKey } = this.resolveCredentials(credentials);
    const encoded = Buffer.from(`${serviceSecret}:${licenseKey}`, 'utf8').toString(
      'base64',
    );
    return {
      headers: {
        Authorization: `ESA ${encoded}`,
        'Content-Type': contentType,
        Accept: contentType.includes('json') ? 'application/json' : 'application/xml',
      },
    };
  }

  private buildUpdateStockXml(itemNumber: string, quantity: number): string {
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

  private buildUpdatePriceXml(itemNumber: string, price: number): string {
    const sku = escapeXml(itemNumber);
    const amount = Math.max(0, Math.round(price));
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <itemUpdateRequest>
    <item>
      <itemNumber>${sku}</itemNumber>
      <itemPrice>${String(amount)}</itemPrice>
    </item>
  </itemUpdateRequest>
</request>`;
  }

  private unwrapOrderList(data: RakutenGetOrderResponse): RakutenOrderModel[] {
    const list = data.OrderModelList ?? data.orderModelList;
    return Array.isArray(list) ? list : [];
  }

  private extractOrderNumbers(data: RakutenSearchOrderResponse): string[] {
    const direct = data.orderNumberList ?? data.OrderNumberList;
    if (Array.isArray(direct)) {
      return direct.filter((n): n is string => typeof n === 'string' && n.length > 0);
    }
    const models = data.OrderModelList ?? data.orderModelList;
    if (!Array.isArray(models)) {
      return [];
    }
    return models
      .map((m) => m.orderNumber)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
  }

  private searchTotalPages(data: RakutenSearchOrderResponse): number | undefined {
    const pag = data.PaginationResponseModel ?? data.paginationResponseModel;
    const total = pag?.totalPages;
    return typeof total === 'number' && Number.isFinite(total) ? total : undefined;
  }

  private collectLines(order: RakutenOrderModel): RakutenOrderLine[] {
    const direct = order.ItemModelList ?? order.itemModelList;
    if (Array.isArray(direct) && direct.length > 0) {
      return direct;
    }
    const fromPkg: RakutenOrderLine[] = [];
    const pkgs = order.PackageModelList ?? order.packageModelList;
    if (!Array.isArray(pkgs)) {
      return fromPkg;
    }
    for (const pkg of pkgs) {
      const items = pkg.ItemModelList ?? pkg.itemModelList;
      if (Array.isArray(items)) {
        fromPkg.push(...items);
      }
    }
    return fromPkg;
  }

  private orderCustomerName(row: RakutenOrderModel): string {
    if (typeof row.ordererName === 'string' && row.ordererName.length > 0) {
      return row.ordererName;
    }
    const orderer = row.OrdererModel;
    if (orderer) {
      const name = orderer.ordererName ?? orderer.name;
      if (typeof name === 'string' && name.length > 0) {
        return name;
      }
    }
    return '—';
  }

  private orderStatus(row: RakutenOrderModel): string {
    if (typeof row.orderStatus === 'string' && row.orderStatus.length > 0) {
      return row.orderStatus;
    }
    if (row.orderProgress !== undefined && row.orderProgress !== null) {
      return String(row.orderProgress);
    }
    return 'UNKNOWN';
  }

  private mapOrder(row: RakutenOrderModel): MarketplaceOrder | null {
    const idRaw = row.orderNumber;
    if (typeof idRaw !== 'string' || idRaw.length === 0) {
      return null;
    }
    const lines = this.collectLines(row);
    const createdRaw = row.orderDatetime;
    return {
      platformOrderId: idRaw,
      status: this.orderStatus(row),
      customerName: this.orderCustomerName(row),
      items: lines.map((l) => {
        const sku = typeof l.itemNumber === 'string' ? l.itemNumber : '';
        const qty =
          typeof l.units === 'number' && Number.isFinite(l.units)
            ? Math.max(0, Math.round(l.units))
            : 0;
        return {
          sku,
          barcode: sku,
          quantity: qty,
          unitPrice: parseMoney(l.price ?? l.itemPrice),
          platformItemId: sku,
          productName:
            typeof l.itemName === 'string' ? l.itemName : undefined,
        };
      }),
      totalAmount: parseMoney(row.totalPrice ?? row.totalAmount),
      currency: 'JPY',
      createdAt:
        typeof createdRaw === 'string' && createdRaw.length > 0
          ? new Date(createdRaw).toISOString()
          : new Date().toISOString(),
    };
  }

  private extractBasketIds(order: RakutenOrderModel): string[] {
    const pkgs = order.PackageModelList ?? order.packageModelList;
    if (!Array.isArray(pkgs)) {
      return [];
    }
    const ids: string[] = [];
    for (const pkg of pkgs) {
      const bid = pkg.basketId ?? pkg.Basketid;
      if (bid !== undefined && bid !== null) {
        ids.push(String(bid));
      }
    }
    return ids;
  }

  private async payPost<T>(
    credentials: Record<string, string>,
    path: string,
    body: Record<string, unknown>,
    maxRetries = 3,
  ): Promise<T> {
    return axiosWithRetry<T>(
      {
        method: 'POST',
        url: `${RAKUTEN_PAY_API_BASE}${path}`,
        timeout: 25_000,
        data: body,
        ...this.esaAuth(credentials, 'application/json; charset=utf-8'),
      },
      { maxRetries },
    );
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 86400000);
      await withRateLimit('RAKUTEN', this.rpm(), async () => {
        await this.payPost<RakutenSearchOrderResponse>(
          credentials,
          '/order/searchOrder/',
          {
            dateType: 1,
            startDatetime: formatRakutenPayDatetime(start),
            endDatetime: formatRakutenPayDatetime(end),
            orderProgressList: [...RAKUTEN_ORDER_PROGRESS_LIST],
            PaginationRequestModel: {
              requestRecordsAmount: 1,
              requestPage: 1,
            },
          },
          1,
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

  async getOrderByNumber(
    credentials: Record<string, string>,
    orderNumber: string,
  ): Promise<RakutenOrderModel | null> {
    try {
      const data = await withRateLimit('RAKUTEN', this.rpm(), async () =>
        this.payPost<RakutenGetOrderResponse>(
          credentials,
          '/order/getOrder/',
          { orderNumberList: [orderNumber], version: 2 },
          1,
        ),
      );
      const list = this.unwrapOrderList(data);
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
      const orderNumbers = new Set<string>();
      let page = 1;
      const perPage = 100;

      for (;;) {
        const data = await withRateLimit('RAKUTEN', this.rpm(), async () =>
          this.payPost<RakutenSearchOrderResponse>(
            credentials,
            '/order/searchOrder/',
            {
              dateType: 1,
              startDatetime: formatRakutenPayDatetime(start),
              endDatetime: formatRakutenPayDatetime(end),
              orderProgressList: [...RAKUTEN_ORDER_PROGRESS_LIST],
              PaginationRequestModel: {
                requestRecordsAmount: perPage,
                requestPage: page,
              },
            },
          ),
        );

        const inline = data.OrderModelList ?? data.orderModelList;
        if (Array.isArray(inline) && inline.length > 0) {
          const mapped = inline
            .map((o) => this.mapOrder(o))
            .filter((x): x is MarketplaceOrder => x !== null);
          return mapped;
        }

        for (const num of this.extractOrderNumbers(data)) {
          orderNumbers.add(num);
        }

        const totalPages = this.searchTotalPages(data);
        if (totalPages !== undefined) {
          if (page >= totalPages) {
            break;
          }
        } else if (this.extractOrderNumbers(data).length < perPage) {
          break;
        }
        page += 1;
      }

      const all: MarketplaceOrder[] = [];
      for (const orderNumber of orderNumbers) {
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
          const sku = u.barcode.trim();
          if (!sku) {
            continue;
          }
          const xml = this.buildUpdateStockXml(sku, u.quantity);
          await axiosWithRetry<string>(
            {
              method: 'POST',
              url: `${RAKUTEN_API_BASE}/item/update`,
              timeout: 25_000,
              data: xml,
              ...this.esaAuth(credentials, 'text/xml;charset=UTF-8'),
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
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      await withRateLimit('RAKUTEN', this.rpm(), async () => {
        for (const u of updates) {
          const sku = u.barcode.trim();
          if (!sku) {
            continue;
          }
          const price = u.salePrice > 0 ? u.salePrice : u.listPrice;
          const xml = this.buildUpdatePriceXml(sku, price);
          await axiosWithRetry<string>(
            {
              method: 'POST',
              url: `${RAKUTEN_API_BASE}/item/update`,
              timeout: 25_000,
              data: xml,
              ...this.esaAuth(credentials, 'text/xml;charset=UTF-8'),
            },
            { maxRetries: 2 },
          );
        }
      });
    } catch (error) {
      throwSyncFailed('RAKUTEN', 'updatePrice', error);
    }
  }

  /**
   * Rakuten Pay — POST /order/updateOrderShipping/
   * basketId verilmezse sipariş detayından ilk sepet kimliği kullanılır.
   */
  async shipOrder(
    credentials: Record<string, string>,
    orderNumber: string,
    trackingNumber: string,
    deliveryCompanyCode: string,
    basketId?: string,
  ): Promise<void> {
    try {
      await withRateLimit('RAKUTEN', this.rpm(), async () => {
        let baskets: string[] = basketId ? [basketId] : [];
        if (baskets.length === 0) {
          const order = await this.getOrderByNumber(credentials, orderNumber);
          if (!order) {
            throw new Error('Sipariş bulunamadı');
          }
          baskets = this.extractBasketIds(order);
        }
        if (baskets.length === 0) {
          throw new Error('Kargo için basketId bulunamadı');
        }

        const shippingDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
          .format(new Date())
          .replace(/\//g, '-');

        const BasketidModelList = baskets.map((bid) => ({
          basketId: bid,
          ShippingModelList: [
            {
              deliveryCompany: deliveryCompanyCode,
              shippingNumber: trackingNumber,
              shippingDate,
            },
          ],
        }));

        await this.payPost<unknown>(
          credentials,
          '/order/updateOrderShipping/',
          { orderNumber, BasketidModelList },
          2,
        );
      });
    } catch (error) {
      throwSyncFailed('RAKUTEN', 'shipOrder', error);
    }
  }
}
