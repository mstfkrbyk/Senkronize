import { Injectable, Logger } from '@nestjs/common';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';
import { isRecord, parseMoney, throwSyncFailed } from '../stub-helpers';
import type {
  Qoo10ApiEnvelope,
  Qoo10GoodsRow,
  Qoo10ShippingRow,
} from './qoo10.types';

const QOO10_BASE =
  'https://api.qoo10.jp/GMKT.INC.Front.BizAPI/Biz.qxf';
const METHOD_SHIPPING_INFO = 'ShoppingCartOffSale.GetShippingInfo';
const METHOD_SET_STOCK = 'ItemsBasic.SetSellingStockQty';
const METHOD_SET_PRICE = 'ItemsBasic.UpdateSellingPrice';
const METHOD_ALL_GOODS = 'ItemsBasic.GetAllGoodsInfo';

@Injectable()
export class Qoo10Adapter implements IMarketplaceAdapter {
  readonly platform = 'QOO10';
  private readonly logger = new Logger(Qoo10Adapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.QOO10 ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private requireQKey(credentials: Record<string, string>): string {
    const qKey = credentials.apiKey?.trim() ?? credentials.qKey?.trim();
    if (!qKey) {
      throw new Error('Qoo10: apiKey (QKey) zorunludur');
    }
    return qKey;
  }

  private goodsCd(credentials: Record<string, string>): string | undefined {
    const raw = credentials.goodsCd?.trim() ?? credentials.GoodsCd?.trim();
    return raw && raw.length > 0 ? raw : undefined;
  }

  private formatQoo10Date(d: Date): string {
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  private buildUrl(
    method: string,
    qKey: string,
    extraParams: Record<string, string> = {},
  ): string {
    const params = new URLSearchParams({
      v: '1.0',
      method,
      key: qKey,
      returnType: 'json',
      ...extraParams,
    });
    return `${QOO10_BASE}?${params.toString()}`;
  }

  private unwrapResult(data: unknown): unknown {
    if (!isRecord(data)) {
      return data;
    }
    const env = data as Qoo10ApiEnvelope;
    const code = env.ResultCode;
    if (code !== undefined && code !== 0 && code !== '0' && code !== '00') {
      const msg =
        typeof env.ResultMsg === 'string' ? env.ResultMsg : 'Qoo10 API hatası';
      throw new Error(msg);
    }
    return env.ResultObject ?? data;
  }

  private ensureArray<T>(v: T | T[] | undefined): T[] {
    if (v === undefined) {
      return [];
    }
    return Array.isArray(v) ? v : [v];
  }

  private splitBarcode(barcode: string): { itemCode: string; optionCode: string } {
    const sep = barcode.includes('|') ? '|' : barcode.includes(':') ? ':' : null;
    if (sep) {
      const [itemCode, optionCode] = barcode.split(sep, 2);
      return {
        itemCode: itemCode.trim(),
        optionCode: (optionCode ?? '').trim(),
      };
    }
    return { itemCode: barcode.trim(), optionCode: '' };
  }

  private async invoke<T>(
    credentials: Record<string, string>,
    method: string,
    httpMethod: 'GET' | 'POST',
    params: Record<string, string> = {},
    body?: Record<string, unknown>,
  ): Promise<T> {
    const qKey = this.requireQKey(credentials);
    const goods = this.goodsCd(credentials);
    const query: Record<string, string> = { ...params };
    if (goods) {
      query.gd_cd = goods;
      query.GoodsCd = goods;
    }
    const url = this.buildUrl(method, qKey, query);
    let result: unknown;
    await withRateLimit('QOO10', this.rpm(), async () => {
      result = await axiosWithRetry<unknown>(
        {
          method: httpMethod,
          url,
          timeout: 25_000,
          headers: { 'Content-Type': 'application/json' },
          data: body,
        },
        {},
      );
    });
    return this.unwrapResult(result) as T;
  }

  private mapOrder(row: Qoo10ShippingRow): MarketplaceOrder | null {
    const idRaw = row.OrderNo ?? row.PackNo;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const name =
      typeof row.BuyerName === 'string' && row.BuyerName.length > 0
        ? row.BuyerName
        : typeof row.Buyer === 'string' && row.Buyer.length > 0
          ? row.Buyer
          : '—';
    const itemCode =
      typeof row.ItemCode === 'string' ? row.ItemCode : String(row.ItemCode ?? '');
    const qtyRaw = row.OrderQty;
    const quantity =
      typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
        ? Math.max(0, Math.round(qtyRaw))
        : typeof qtyRaw === 'string'
          ? Math.max(0, Math.round(parseFloat(qtyRaw) || 0))
          : 1;
    const createdRaw = row.OrderDate ?? row.PaymentDate;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    return {
      platformOrderId: String(idRaw),
      status:
        typeof row.ShippingStatus === 'string' ? row.ShippingStatus : 'DELIVERY_WAIT',
      customerName: name,
      items: [
        {
          sku: itemCode,
          barcode: itemCode,
          quantity,
          unitPrice: parseMoney(row.OrderPrice ?? row.Total),
          platformItemId: itemCode,
          productName:
            typeof row.ItemTitle === 'string' ? row.ItemTitle : undefined,
        },
      ],
      totalAmount: parseMoney(row.Total ?? row.OrderPrice),
      currency: typeof row.Currency === 'string' ? row.Currency : 'JPY',
      createdAt,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 1);
      await this.invoke<unknown>(
        credentials,
        METHOD_SHIPPING_INFO,
        'GET',
        {
          StartDt: this.formatQoo10Date(start),
          EndDt: this.formatQoo10Date(end),
          ShippingStatus: 'DELIVERY_WAIT',
        },
      );
      return true;
    } catch (error) {
      this.logger.warn('Qoo10 bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const end = new Date();
      const start = since ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const raw = await this.invoke<unknown>(credentials, METHOD_SHIPPING_INFO, 'GET', {
        StartDt: this.formatQoo10Date(start),
        EndDt: this.formatQoo10Date(end),
        ShippingStatus: 'DELIVERY_WAIT',
      });
      const rows = this.ensureArray(
        isRecord(raw)
          ? (raw.ShippingInfo as Qoo10ShippingRow[] | Qoo10ShippingRow | undefined)
          : Array.isArray(raw)
            ? (raw as Qoo10ShippingRow[])
            : undefined,
      );
      const list =
        rows.length > 0
          ? rows
          : this.ensureArray(raw as Qoo10ShippingRow | Qoo10ShippingRow[] | undefined);
      return list
        .map((r) => this.mapOrder(r))
        .filter((x): x is MarketplaceOrder => x !== null);
    } catch (error) {
      throwSyncFailed('QOO10', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const raw = await this.invoke<unknown>(credentials, METHOD_ALL_GOODS, 'GET', {
        Page: String(page + 1),
      });
      const rows = this.ensureArray(
        isRecord(raw)
          ? (raw.Items as Qoo10GoodsRow[] | Qoo10GoodsRow | undefined)
          : Array.isArray(raw)
            ? (raw as Qoo10GoodsRow[])
            : undefined,
      );
      const list =
        rows.length > 0
          ? rows
          : this.ensureArray(raw as Qoo10GoodsRow | Qoo10GoodsRow[] | undefined);
      const items: MarketplaceListing[] = list.map((row, i) => {
        const itemCode =
          typeof row.ItemCode === 'string'
            ? row.ItemCode
            : String(row.ItemCode ?? `row-${i}`);
        const option =
          typeof row.OptionCode === 'string' ? row.OptionCode : '';
        const barcode =
          option.length > 0 ? `${itemCode}|${option}` : itemCode;
        const qtyRaw = row.StockQty;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : typeof qtyRaw === 'string'
              ? Math.max(0, Math.round(parseFloat(qtyRaw) || 0))
              : 0;
        const sale = parseMoney(row.ItemPrice);
        const title =
          typeof row.ItemTitle === 'string'
            ? row.ItemTitle
            : typeof row.SellerCode === 'string'
              ? row.SellerCode
              : itemCode;
        return {
          platformProductId: itemCode,
          barcode,
          title,
          quantity,
          salePrice: sale,
          listPrice: sale,
          approved: true,
          images: [],
        };
      });
      return {
        items,
        total: items.length,
        page,
        pageSize: 50,
      };
    } catch (error) {
      throwSyncFailed('QOO10', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      for (const u of updates) {
        const { itemCode, optionCode } = this.splitBarcode(u.barcode);
        await this.invoke<unknown>(credentials, METHOD_SET_STOCK, 'POST', {}, {
          ItemCode: itemCode,
          StockQty: u.quantity,
          OptionCode: optionCode,
        });
      }
    } catch (error) {
      throwSyncFailed('QOO10', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      for (const u of updates) {
        const { itemCode, optionCode } = this.splitBarcode(u.barcode);
        await this.invoke<unknown>(credentials, METHOD_SET_PRICE, 'POST', {}, {
          ItemCode: itemCode,
          ItemPrice: u.salePrice,
          OptionCode: optionCode,
        });
      }
    } catch (error) {
      throwSyncFailed('QOO10', 'updatePrice', error);
    }
  }
}
