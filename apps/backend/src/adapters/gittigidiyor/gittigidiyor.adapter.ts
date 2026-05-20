import { createHash, createHmac } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import axios, { isAxiosError, type AxiosInstance } from 'axios';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';

import { axiosWithRetry, PLATFORM_RATE_LIMITS, withRateLimit } from '../../common/utils/http-retry';
import { isRecord, throwSyncFailed } from '../stub-helpers';
import {
  GITTIGIDIYOR_BASE_URL,
  GITTIGIDIYOR_CURRENCY_TRY,
} from './gittigidiyor.constants';
import type {
  GittigidiyorApiEnvelope,
  GittigidiyorOrderRow,
  GittigidiyorOrdersPayload,
  GittigidiyorProductRow,
  GittigidiyorProductsPayload,
} from './gittigidiyor.types';

function formatGgDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function hashRolePassword(password: string): string {
  return createHash('md5').update(password, 'utf8').digest('hex');
}

function buildGgSign(apiKey: string, apiSecret: string): { sign: string; time: string } {
  const time = String(Date.now());
  const sign = createHmac('sha1', apiSecret).update(apiKey + time, 'utf8').digest('base64');
  return { sign, time };
}

function resolveGgCredentials(credentials: Record<string, string>): {
  apiKey: string;
  apiSecret: string;
  roleUsername: string;
  rolePasswordHash: string;
} {
  const apiKey = credentials.apiKey?.trim() ?? '';
  const apiSecret = credentials.apiSecret?.trim() ?? '';
  const roleUsername =
    credentials.roleUsername?.trim() ||
    credentials.username?.trim() ||
    '';
  const rolePasswordPlain =
    credentials.rolePassword?.trim() ||
    credentials.password?.trim() ||
    '';
  const rolePasswordHash =
    credentials.rolePasswordHash?.trim() ||
    (rolePasswordPlain.length > 0 ? hashRolePassword(rolePasswordPlain) : '');
  if (!apiKey || !apiSecret || !roleUsername || !rolePasswordHash) {
    throw new Error(
      'GittiGidiyor: apiKey, apiSecret, roleUsername ve rolePassword zorunludur',
    );
  }
  return { apiKey, apiSecret, roleUsername, rolePasswordHash };
}

function ggToApiError(context: string, error: unknown): Error {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    let detail = error.message;
    if (typeof data === 'object' && data !== null) {
      const envelope = data as GittigidiyorApiEnvelope;
      if (envelope.error?.message) {
        detail = envelope.error.message;
      } else if (typeof envelope.ackCode === 'string' && envelope.ackCode !== 'success') {
        detail = envelope.ackCode;
      }
    }
    return new Error(
      `GittiGidiyor ${context}${status != null ? ` (${String(status)})` : ''}: ${detail}`,
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(`GittiGidiyor ${context}: Bilinmeyen hata`);
}

function assertGgSuccess<T>(envelope: GittigidiyorApiEnvelope<T>, context: string): T {
  const ack = typeof envelope.ackCode === 'string' ? envelope.ackCode.toLowerCase() : '';
  if (ack === 'success' || ack === 'ok') {
    return (envelope.data ?? envelope) as T;
  }
  if (envelope.error?.message) {
    throw new Error(`GittiGidiyor ${context}: ${envelope.error.message}`);
  }
  if (ack.length > 0) {
    throw new Error(`GittiGidiyor ${context}: ${envelope.ackCode}`);
  }
  return (envelope.data ?? envelope) as T;
}

function normalizeProductRows(payload: unknown): GittigidiyorProductRow[] {
  if (!isRecord(payload)) {
    return [];
  }
  const body = payload as GittigidiyorProductsPayload;
  if (Array.isArray(body.products)) {
    return body.products;
  }
  if (Array.isArray(body.product)) {
    return body.product;
  }
  if (isRecord(body.product)) {
    return [body.product];
  }
  return [];
}

function normalizeOrderRows(payload: unknown): GittigidiyorOrderRow[] {
  if (!isRecord(payload)) {
    return [];
  }
  const body = payload as GittigidiyorOrdersPayload;
  if (Array.isArray(body.orders)) {
    return body.orders;
  }
  if (Array.isArray(body.order)) {
    return body.order;
  }
  if (isRecord(body.order)) {
    return [body.order];
  }
  return [];
}

@Injectable()
export class GittigidiyorAdapter implements IMarketplaceAdapter {
  readonly platform = 'GITTIGIDIYOR';
  private readonly logger = new Logger(GittigidiyorAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.GITTIGIDIYOR ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private getClient(credentials: Record<string, string>): AxiosInstance {
    const { apiKey, apiSecret } = resolveGgCredentials(credentials);
    const basic = Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64');
    return axios.create({
      baseURL: GITTIGIDIYOR_BASE_URL,
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 25_000,
    });
  }

  private authParams(credentials: Record<string, string>): Record<string, string> {
    const { apiKey, apiSecret, roleUsername, rolePasswordHash } =
      resolveGgCredentials(credentials);
    const { sign, time } = buildGgSign(apiKey, apiSecret);
    return {
      apiKey,
      sign,
      time,
      roleUsername,
      rolePassword: rolePasswordHash,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const client = this.getClient(credentials);
      await withRateLimit(this.platform, this.rpm(), async () => {
        const { data } = await client.get<GittigidiyorApiEnvelope<GittigidiyorProductsPayload>>(
          '/product/getProducts/json',
          {
            params: {
              ...this.authParams(credentials),
              category: 0,
              active: 1,
              pageSize: 1,
              pageNumber: 1,
            },
          },
        );
        assertGgSuccess(data, 'bağlantı testi');
      });
      return true;
    } catch (error) {
      this.logger.warn('GittiGidiyor bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  private mapProduct(row: GittigidiyorProductRow): MarketplaceListing | null {
    const code =
      (typeof row.productCode === 'string' && row.productCode) ||
      (row.productId !== undefined ? String(row.productId) : '');
    if (!code) {
      return null;
    }
    const title = typeof row.title === 'string' ? row.title : code;
    const qtyRaw = row.stockAmount ?? row.stock ?? 0;
    const qty =
      typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
        ? Math.max(0, Math.round(qtyRaw))
        : 0;
    const price =
      typeof row.price === 'number' && Number.isFinite(row.price) ? row.price : 0;
    const images: string[] = [];
    if (Array.isArray(row.images)) {
      for (const im of row.images) {
        const url = im.imageUrl ?? im.url;
        if (typeof url === 'string' && url.length > 0) {
          images.push(url);
        }
      }
    }
    return {
      platformProductId: code,
      barcode: code,
      title,
      quantity: qty,
      salePrice: price,
      listPrice: price,
      approved: row.active === undefined || row.active === 1 || row.active === true,
      images,
    };
  }

  private mapOrder(row: GittigidiyorOrderRow): MarketplaceOrder | null {
    const id = row.orderId ?? row.saleCode;
    if (id === undefined || id === null) {
      return null;
    }
    const customer =
      (typeof row.buyerName === 'string' && row.buyerName) ||
      (typeof row.buyer === 'string' && row.buyer) ||
      '—';
    const total =
      typeof row.price === 'number'
        ? row.price
        : typeof row.amount === 'number'
          ? row.amount
          : 0;
    const items = Array.isArray(row.items)
      ? row.items.map((line) => {
          const sku = line.productCode ?? line.stockCode ?? '';
          const qty =
            typeof line.quantity === 'number' && Number.isFinite(line.quantity)
              ? Math.max(0, Math.round(line.quantity))
              : 1;
          const unit =
            typeof line.price === 'number' && Number.isFinite(line.price) ? line.price : 0;
          return {
            sku,
            barcode: sku,
            quantity: qty,
            unitPrice: unit,
            platformItemId: sku,
            productName: line.title,
          };
        })
      : [];
    let createdAt = new Date().toISOString();
    if (typeof row.orderDate === 'string' && row.orderDate.length > 0) {
      const parts = row.orderDate.split(/[./-]/).map((p) => Number.parseInt(p, 10));
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        const [day, month, year] = parts;
        createdAt = new Date(year, month - 1, day).toISOString();
      }
    }
    return {
      platformOrderId: String(id),
      status: row.status !== undefined ? String(row.status) : '1',
      customerName: customer,
      items,
      totalAmount: total,
      currency: 'TRY',
      createdAt,
      cargoTrackingNumber:
        typeof row.cargoCode === 'string' ? row.cargoCode : undefined,
      cargoProvider:
        typeof row.cargoCompany === 'string' ? row.cargoCompany : undefined,
    };
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    try {
      const client = this.getClient(credentials);
      const end = new Date();
      const start = since ?? new Date(end.getTime() - 7 * 86400000);
      const rows = await withRateLimit(this.platform, this.rpm(), async () => {
        const { data } = await client.get<
          GittigidiyorApiEnvelope<GittigidiyorOrdersPayload>
        >('/order/getOrderList/json', {
          params: {
            ...this.authParams(credentials),
            startDate: formatGgDate(start),
            endDate: formatGgDate(end),
            status: 1,
          },
        });
        const payload = assertGgSuccess(data, 'sipariş listesi');
        return normalizeOrderRows(payload);
      });
      return rows
        .map((r) => this.mapOrder(r))
        .filter((x): x is MarketplaceOrder => x !== null);
    } catch (error) {
      throwSyncFailed(this.platform, 'getOrders', ggToApiError('sipariş listesi', error));
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const client = this.getClient(credentials);
      const pageNumber = page + 1;
      const pageSize = 20;
      const result = await withRateLimit(this.platform, this.rpm(), async () => {
        const { data } = await client.get<
          GittigidiyorApiEnvelope<GittigidiyorProductsPayload>
        >('/product/getProducts/json', {
          params: {
            ...this.authParams(credentials),
            category: 0,
            active: 1,
            pageSize,
            pageNumber,
          },
        });
        const payload = assertGgSuccess(data, 'ürün listesi');
        const products = normalizeProductRows(payload);
        const total =
          typeof payload.totalCount === 'number' ? payload.totalCount : products.length;
        return { products, total };
      });
      const items = result.products
        .map((p) => this.mapProduct(p))
        .filter((x): x is MarketplaceListing => x !== null);
      return {
        items,
        total: result.total,
        page,
        pageSize,
      };
    } catch (error) {
      throwSyncFailed(this.platform, 'getListings', ggToApiError('ürün listesi', error));
    }
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const client = this.getClient(credentials);
      await withRateLimit(this.platform, this.rpm(), async () => {
        for (const u of updates) {
          const { data } = await client.post<GittigidiyorApiEnvelope>(
            '/product/updateProductStock/json',
            {
              ...this.authParams(credentials),
              productCode: u.barcode,
              stockAmount: Math.max(0, Math.round(u.quantity)),
            },
          );
          assertGgSuccess(data, `stok güncelleme (${u.barcode})`);
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updateStock', ggToApiError('stok güncelleme', error));
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const client = this.getClient(credentials);
      await withRateLimit(this.platform, this.rpm(), async () => {
        for (const u of updates) {
          const { data } = await client.post<GittigidiyorApiEnvelope>(
            '/product/updateProductPrice/json',
            {
              ...this.authParams(credentials),
              productCode: u.barcode,
              price: u.salePrice,
              currencyId: GITTIGIDIYOR_CURRENCY_TRY,
            },
          );
          assertGgSuccess(data, `fiyat güncelleme (${u.barcode})`);
        }
      });
    } catch (error) {
      throwSyncFailed(this.platform, 'updatePrice', ggToApiError('fiyat güncelleme', error));
    }
  }
}
