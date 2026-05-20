import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import {
  isRecord,
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
} from '../stub-helpers';
import {
  TEMU_API_BASE,
  TEMU_GOODS_LIST_PATH,
  TEMU_ORDER_LIST_PATH,
  TEMU_ORDER_SHIP_PATH,
  TEMU_ORDER_STATUS_UNSHIPPED,
  TEMU_PRICE_UPDATE_PATH,
  TEMU_STOCK_UPDATE_PATH,
} from './temu.constants';
import { temuHmacSignature } from './temu.sign';
import type {
  TemuGoodsIds,
  TemuOrder,
  TemuOrderLine,
  TemuShipPayload,
} from './temu.types';

@Injectable()
export class TemuAdapter implements IMarketplaceAdapter {
  readonly platform = 'TEMU';
  private readonly logger = new Logger(TemuAdapter.name);

  private resolveCredentials(credentials: Record<string, string>): {
    apiKey: string;
    secretKey: string;
  } {
    const apiKey =
      credentials.apiKey?.trim() ??
      credentials.accessKey?.trim() ??
      credentials.appKey?.trim();
    const secretKey =
      credentials.secretKey?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.appSecret?.trim();
    if (!apiKey || !secretKey) {
      throw new Error('Temu: apiKey ve secretKey zorunludur');
    }
    return { apiKey, secretKey };
  }

  /** barcode: `goodsId:skuId` veya yalnızca skuId (goodsId = skuId) */
  private parseGoodsIds(barcode: string): TemuGoodsIds {
    const sep = barcode.indexOf(':');
    if (sep > 0) {
      return {
        goodsId: barcode.slice(0, sep),
        skuId: barcode.slice(sep + 1),
      };
    }
    return { goodsId: barcode, skuId: barcode };
  }

  private toApiError(error: unknown, label: string): Error {
    if (axios.isAxiosError(error)) {
      const ax = error as AxiosError<{ message?: string; error_msg?: string }>;
      const status = ax.response?.status;
      const body = ax.response?.data;
      const detail =
        typeof body === 'object' && body !== null
          ? (typeof body.message === 'string'
              ? body.message
              : typeof body.error_msg === 'string'
                ? body.error_msg
                : ax.message)
          : ax.message;
      return new Error(
        `${label}${status != null ? ` (${String(status)})` : ''}: ${detail}`,
      );
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(`${label}: istek başarısız`);
  }

  private async request<T>(
    credentials: Record<string, string>,
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, string | number>,
    body?: unknown,
  ): Promise<T> {
    const { apiKey, secretKey } = this.resolveCredentials(credentials);
    const timestamp = Date.now().toString();
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const signature = temuHmacSignature(timestamp, method, path, bodyStr, secretKey);

    const url = `${TEMU_API_BASE}${path}`;
    try {
      const res = await axios.request<T>({
        method,
        url,
        timeout: 25_000,
        headers: {
          'Content-Type': 'application/json',
          'access-key': apiKey,
          timestamp,
          signature,
        },
        params: method === 'GET' ? params : undefined,
        data: method === 'POST' ? body : undefined,
      });
      return res.data;
    } catch (error) {
      throw this.toApiError(error, 'Temu API');
    }
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.request(credentials, 'GET', TEMU_ORDER_LIST_PATH, {
        order_status: TEMU_ORDER_STATUS_UNSHIPPED,
        page_index: 0,
        page_size: 1,
      });
      return true;
    } catch (error) {
      this.logger.warn('Temu bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapOrder(row: unknown): MarketplaceOrder | null {
    if (!isRecord(row)) {
      return null;
    }
    const o = row as TemuOrder;
    const idRaw = o.order_id ?? o.order_sn;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const createdSec = o.create_time;
    const createdAt =
      typeof createdSec === 'number' && Number.isFinite(createdSec)
        ? new Date(createdSec * 1000).toISOString()
        : new Date().toISOString();
    const name =
      typeof o.receiver_name === 'string' && o.receiver_name.length > 0
        ? o.receiver_name
        : '—';
    const lines = Array.isArray(o.item_list) ? o.item_list : [];
    return {
      platformOrderId: String(idRaw),
      status:
        typeof o.order_status === 'string'
          ? o.order_status
          : TEMU_ORDER_STATUS_UNSHIPPED,
      customerName: name,
      items: lines.map((l: TemuOrderLine) => ({
        sku: typeof l.sku_id === 'string' ? l.sku_id : '',
        barcode:
          typeof l.goods_id === 'string' && typeof l.sku_id === 'string'
            ? `${l.goods_id}:${l.sku_id}`
            : typeof l.sku_id === 'string'
              ? l.sku_id
              : '',
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.sale_price ?? l.price),
        platformItemId: typeof l.sku_id === 'string' ? l.sku_id : '',
        productName: typeof l.goods_name === 'string' ? l.goods_name : undefined,
      })),
      totalAmount: parseMoney(o.order_amount),
      currency: typeof o.currency === 'string' ? o.currency : 'TRY',
      createdAt,
    };
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const all: MarketplaceOrder[] = [];
    let pageIndex = 0;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore) {
      const data = await this.request<unknown>(
        credentials,
        'GET',
        TEMU_ORDER_LIST_PATH,
        {
          order_status: TEMU_ORDER_STATUS_UNSHIPPED,
          page_index: pageIndex,
          page_size: pageSize,
        },
      );

      const rows = normalizeOrdersRows(data)
        .map((r) => this.mapOrder(r))
        .filter((x): x is MarketplaceOrder => x !== null);

      for (const order of rows) {
        if (since && new Date(order.createdAt).getTime() < since.getTime()) {
          continue;
        }
        all.push(order);
      }

      if (isRecord(data)) {
        const totalRaw = data.totalCount ?? data.total;
        const total =
          typeof totalRaw === 'number' && Number.isFinite(totalRaw)
            ? totalRaw
            : undefined;
        if (typeof total === 'number') {
          hasMore = (pageIndex + 1) * pageSize < total;
        } else {
          hasMore = rows.length >= pageSize;
        }
      } else {
        hasMore = rows.length >= pageSize;
      }
      pageIndex += 1;
    }

    return all;
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    const data = await this.request<unknown>(
      credentials,
      'GET',
      TEMU_GOODS_LIST_PATH,
      {
        page_index: page,
        page_size: 50,
      },
    );

    const { rows, total } = normalizeProductRows(data);
    const items: MarketplaceListing[] = rows.map((row, i) => {
      const p = isRecord(row) ? row : {};
      const goodsId = p.goods_id ?? p.goodsId;
      const skuId = p.sku_id ?? p.skuId ?? p.id;
      const id =
        goodsId !== undefined && skuId !== undefined
          ? `${String(goodsId)}:${String(skuId)}`
          : skuId !== undefined
            ? String(skuId)
            : `row-${String(i)}`;
      const barcode = id;
      const titleRaw = p.goods_name ?? p.title ?? barcode;
      const title =
        typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
      const sale = parseMoney(p.sale_price ?? p.price);
      const qtyRaw = p.stock_quantity ?? p.stock ?? p.quantity ?? 0;
      const quantity =
        typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
          ? Math.max(0, Math.round(qtyRaw))
          : 0;
      return {
        platformProductId:
          goodsId !== undefined ? String(goodsId) : barcode,
        barcode,
        title,
        quantity,
        salePrice: sale,
        listPrice: parseMoney(p.list_price ?? sale),
        approved: true,
        images: [],
      };
    });

    return {
      items,
      total: typeof total === 'number' ? total : items.length,
      page,
      pageSize: 50,
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    const body = updates.map((u) => {
      const { goodsId, skuId } = this.parseGoodsIds(u.barcode);
      return {
        goods_id: goodsId,
        sku_id: skuId,
        stock_quantity: u.quantity,
      };
    });
    await this.request(credentials, 'POST', TEMU_STOCK_UPDATE_PATH, undefined, body);
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    const body = updates.map((u) => {
      const { goodsId, skuId } = this.parseGoodsIds(u.barcode);
      return {
        goods_id: goodsId,
        sku_id: skuId,
        price: u.salePrice,
      };
    });
    await this.request(credentials, 'POST', TEMU_PRICE_UPDATE_PATH, undefined, body);
  }

  /** Kargo bildirimi — `POST /order/ship` */
  async submitShipment(
    credentials: Record<string, string>,
    payload: TemuShipPayload,
  ): Promise<void> {
    await this.request(credentials, 'POST', TEMU_ORDER_SHIP_PATH, undefined, payload);
  }
}
