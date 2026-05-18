import { createHmac } from 'node:crypto';

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
import {
  isRecord,
  normalizeOrdersRows,
  normalizeProductRows,
  parseMoney,
  throwSyncFailed,
} from '../stub-helpers';
import type { TemuApiEnvelope, TemuOrder, TemuOrderLine } from './temu.types';

const TEMU_BASE = 'https://openapi.temu.com/openapi';

function signTemuRequest(appSecret: string, signParams: Record<string, string>): string {
  const keys = Object.keys(signParams).sort();
  const base = keys.map((k) => `${k}${signParams[k]}`).join('');
  return createHmac('sha256', appSecret).update(base, 'utf8').digest('hex');
}

@Injectable()
export class TemuAdapter implements IMarketplaceAdapter {
  readonly platform = 'TEMU';
  private readonly logger = new Logger(TemuAdapter.name);

  constructor(private readonly encryptionService: EncryptionService) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.TEMU ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private async invoke<T>(
    credentials: Record<string, string>,
    apiType: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const appKey = credentials.appKey?.trim();
    const appSecret = credentials.appSecret?.trim();
    if (!appKey || !appSecret) {
      throw new Error('Temu: appKey ve appSecret zorunludur');
    }
    const timestamp = String(Math.floor(Date.now() / 1000));
    const dataStr = JSON.stringify(payload);
    const signParams: Record<string, string> = {
      app_key: appKey,
      data: dataStr,
      timestamp,
      type: apiType,
    };
    const sign = signTemuRequest(appSecret, signParams);
    const url = TEMU_BASE;
    return axiosWithRetry<T>(
      {
        method: 'POST',
        url,
        timeout: 25_000,
        headers: { 'Content-Type': 'application/json' },
        data: {
          app_key: appKey,
          timestamp,
          type: apiType,
          sign,
          data: dataStr,
        },
      },
      {},
    );
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await this.invoke<TemuApiEnvelope>(
        credentials,
        'bg.open.accesstoken.info.get',
        {},
      );
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
    const idRaw = o.order_sn;
    if (typeof idRaw !== 'string' || idRaw.length === 0) {
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
      platformOrderId: idRaw,
      status: typeof o.order_status === 'string' ? o.order_status : 'NEW',
      customerName: name,
      items: lines.map((l: TemuOrderLine) => ({
        sku: typeof l.sku_id === 'string' ? l.sku_id : '',
        barcode: typeof l.sku_id === 'string' ? l.sku_id : '',
        quantity:
          typeof l.quantity === 'number' && Number.isFinite(l.quantity)
            ? Math.max(0, Math.round(l.quantity))
            : 0,
        unitPrice: parseMoney(l.sale_price),
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
    try {
      const sinceMs = since ? since.getTime() : undefined;
      let rows: MarketplaceOrder[] = [];
      await withRateLimit('TEMU', this.rpm(), async () => {
        const data = await this.invoke<unknown>(credentials, 'bg.order.list.get', {
          page: 1,
          page_size: 50,
          ...(sinceMs !== undefined ? { update_time_from: Math.floor(sinceMs / 1000) } : {}),
        });
        rows = normalizeOrdersRows(data)
          .map((r) => this.mapOrder(r))
          .filter((x): x is MarketplaceOrder => x !== null);
      });
      return rows;
    } catch (error) {
      throwSyncFailed('TEMU', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const { rows, total } = await withRateLimit('TEMU', this.rpm(), async () => {
        const data = await this.invoke<unknown>(credentials, 'bg.goods.list.get', {
          page: page + 1,
          page_size: 50,
        });
        return normalizeProductRows(data);
      });
      const items: MarketplaceListing[] = rows.map((row, i) => {
        const p = isRecord(row) ? row : {};
        const idRaw = p.sku_id ?? p.goods_id ?? p.id;
        const id =
          idRaw !== undefined && idRaw !== null ? String(idRaw) : `row-${i}`;
        const barcode =
          typeof p.sku_id === 'string'
            ? p.sku_id
            : typeof p.barcode === 'string'
              ? p.barcode
              : id;
        const titleRaw = p.goods_name ?? p.title ?? barcode;
        const title =
          typeof titleRaw === 'string' ? titleRaw : String(titleRaw);
        const sale = parseMoney(p.sale_price ?? p.price);
        const qtyRaw = p.stock ?? p.quantity ?? 0;
        const quantity =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? Math.max(0, Math.round(qtyRaw))
            : 0;
        return {
          platformProductId: id,
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
    } catch (error) {
      throwSyncFailed('TEMU', 'getListings', error);
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      await withRateLimit('TEMU', this.rpm(), async () => {
        await this.invoke<unknown>(credentials, 'bg.goods.stock.update', {
          stock_list: updates.map((u) => ({ sku_id: u.barcode, stock: u.quantity })),
        });
      });
    } catch (error) {
      throwSyncFailed('TEMU', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      await withRateLimit('TEMU', this.rpm(), async () => {
        await this.invoke<unknown>(credentials, 'bg.goods.price.update', {
          price_list: updates.map((u) => ({
            sku_id: u.barcode,
            sale_price: u.salePrice,
            list_price: u.listPrice,
          })),
        });
      });
    } catch (error) {
      throwSyncFailed('TEMU', 'updatePrice', error);
    }
  }
}
