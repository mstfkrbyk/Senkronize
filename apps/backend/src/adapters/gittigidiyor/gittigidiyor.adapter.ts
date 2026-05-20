import { createHash } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import axios, { isAxiosError } from 'axios';
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
  GITTIGIDIYOR_CURRENCY_TRY,
  GITTIGIDIYOR_DEVAPI_BASE,
  GITTIGIDIYOR_ORDER_STATUSES,
} from './gittigidiyor.constants';
import { buildLegacyGgSign, signGittigidiyorOAuthRequest } from './gittigidiyor.oauth';
import type {
  GittigidiyorApiEnvelope,
  GittigidiyorOrderRow,
  GittigidiyorOrdersPayload,
  GittigidiyorProductRow,
  GittigidiyorProductsPayload,
} from './gittigidiyor.types';

export interface GittigidiyorTrackingPayload {
  orderId: string;
  trackingNumber: string;
  cargoCompany?: string;
}

function hashRolePassword(password: string): string {
  return createHash('md5').update(password, 'utf8').digest('hex');
}

function resolveGgCredentials(credentials: Record<string, string>): {
  apiKey: string;
  apiSecret: string;
  oauthToken?: string;
  oauthTokenSecret?: string;
  roleUsername?: string;
  rolePasswordHash?: string;
} {
  const apiKey = credentials.apiKey?.trim() ?? '';
  const apiSecret = credentials.apiSecret?.trim() ?? '';
  const oauthToken =
    credentials.oauthToken?.trim() ||
    credentials.accessToken?.trim() ||
    undefined;
  const oauthTokenSecret =
    credentials.oauthTokenSecret?.trim() ||
    credentials.accessTokenSecret?.trim() ||
    undefined;
  const roleUsername =
    credentials.roleUsername?.trim() ||
    credentials.username?.trim() ||
    undefined;
  const rolePasswordPlain =
    credentials.rolePassword?.trim() ||
    credentials.password?.trim() ||
    '';
  const rolePasswordHash =
    credentials.rolePasswordHash?.trim() ||
    (rolePasswordPlain.length > 0 ? hashRolePassword(rolePasswordPlain) : undefined);

  if (!apiKey || !apiSecret) {
    throw new Error('GittiGidiyor: apiKey ve apiSecret zorunludur');
  }
  const hasOAuth = Boolean(oauthToken && oauthTokenSecret);
  const hasRole = Boolean(roleUsername && rolePasswordHash);
  if (!hasOAuth && !hasRole) {
    throw new Error(
      'GittiGidiyor: OAuth token çifti veya roleUsername + rolePassword zorunludur',
    );
  }
  return {
    apiKey,
    apiSecret,
    oauthToken,
    oauthTokenSecret,
    roleUsername,
    rolePasswordHash,
  };
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
  if (Array.isArray(body.items)) {
    return body.items;
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

  private legacyAuthParams(credentials: Record<string, string>): Record<string, string> {
    const { apiKey, apiSecret, roleUsername, rolePasswordHash } =
      resolveGgCredentials(credentials);
    const { sign, time } = buildLegacyGgSign(apiKey, apiSecret);
    return {
      apiKey,
      sign,
      time,
      roleUsername: roleUsername ?? '',
      rolePassword: rolePasswordHash ?? '',
    };
  }

  private async oauthRequest<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    credentials: Record<string, string>,
    params: Record<string, string> = {},
    body?: Record<string, unknown>,
  ): Promise<T> {
    const { apiKey, apiSecret, oauthToken, oauthTokenSecret } =
      resolveGgCredentials(credentials);
    if (!oauthToken || !oauthTokenSecret) {
      throw new Error('GittiGidiyor: OAuth token çifti zorunludur');
    }
    const signed = signGittigidiyorOAuthRequest(
      method,
      path,
      apiKey,
      apiSecret,
      oauthToken,
      oauthTokenSecret,
      params,
    );
    const { data } = await axios.request<T>({
      method,
      url: signed.url,
      headers: {
        ...signed.headers,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { data: body } : {}),
      timeout: 25_000,
    });
    return data;
  }

  private async legacyRequest<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    credentials: Record<string, string>,
    params: Record<string, string | number> = {},
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${GITTIGIDIYOR_DEVAPI_BASE}${path.startsWith('/') ? path : `/${path}`}`;
    const { apiKey, apiSecret } = resolveGgCredentials(credentials);
    const basic = Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64');
    const { data } = await axios.request<T>({
      method,
      url,
      params: { ...this.legacyAuthParams(credentials), ...params },
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { data: body } : {}),
      timeout: 25_000,
    });
    return data;
  }

  private usesOAuth(credentials: Record<string, string>): boolean {
    const creds = resolveGgCredentials(credentials);
    return Boolean(creds.oauthToken && creds.oauthTokenSecret);
  }

  private async apiGet<T>(
    path: string,
    credentials: Record<string, string>,
    params: Record<string, string> = {},
  ): Promise<T> {
    if (this.usesOAuth(credentials)) {
      return this.oauthRequest<T>('GET', path, credentials, params);
    }
    return this.legacyRequest<T>('GET', path, credentials, params);
  }

  private async apiPut<T>(
    path: string,
    credentials: Record<string, string>,
    body: Record<string, unknown>,
    params: Record<string, string> = {},
  ): Promise<T> {
    if (this.usesOAuth(credentials)) {
      return this.oauthRequest<T>('PUT', path, credentials, params, body);
    }
    return this.legacyRequest<T>('PUT', path, credentials, params, body);
  }

  private async apiPost<T>(
    path: string,
    credentials: Record<string, string>,
    body: Record<string, unknown>,
    params: Record<string, string> = {},
  ): Promise<T> {
    if (this.usesOAuth(credentials)) {
      return this.oauthRequest<T>('POST', path, credentials, params, body);
    }
    return this.legacyRequest<T>('POST', path, credentials, params, body);
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      await withRateLimit(this.platform, this.rpm(), async () => {
        const data = await this.apiGet<GittigidiyorApiEnvelope<GittigidiyorProductsPayload>>(
          '/item/getItemList',
          credentials,
          { page: '1', size: '1' },
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
      (typeof row.itemId === 'string' && row.itemId) ||
      (row.productId !== undefined ? String(row.productId) : '');
    if (!code) {
      return null;
    }
    const title = typeof row.title === 'string' ? row.title : code;
    const qtyRaw = row.stockAmount ?? row.stock ?? row.quantity ?? 0;
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
      status: row.status !== undefined ? String(row.status) : 'WaitingforShipment',
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
      void since;
      const allRows: GittigidiyorOrderRow[] = [];
      await withRateLimit(this.platform, this.rpm(), async () => {
        for (const status of GITTIGIDIYOR_ORDER_STATUSES) {
          const data = await this.apiGet<GittigidiyorApiEnvelope<GittigidiyorOrdersPayload>>(
            '/trade/getOrders',
            credentials,
            { role: 'seller', status },
          );
          const payload = assertGgSuccess(data, `sipariş listesi (${status})`);
          allRows.push(...normalizeOrderRows(payload));
        }
      });
      const seen = new Set<string>();
      const unique = allRows.filter((row) => {
        const id = row.orderId ?? row.saleCode;
        if (id === undefined || id === null) {
          return false;
        }
        const key = String(id);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      return unique
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
      const pageNumber = page + 1;
      const pageSize = 20;
      const result = await withRateLimit(this.platform, this.rpm(), async () => {
        const data = await this.apiGet<GittigidiyorApiEnvelope<GittigidiyorProductsPayload>>(
          '/item/getItemList',
          credentials,
          {
            page: String(pageNumber),
            size: String(pageSize),
          },
        );
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
      await withRateLimit(this.platform, this.rpm(), async () => {
        for (const u of updates) {
          const data = await this.apiPut<GittigidiyorApiEnvelope>(
            '/item/editItem',
            credentials,
            {
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
      await withRateLimit(this.platform, this.rpm(), async () => {
        for (const u of updates) {
          const data = await this.apiPut<GittigidiyorApiEnvelope>(
            '/item/editItem',
            credentials,
            {
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

  /** Kargo takip numarası — POST trade/setTrackingNumber */
  async setTrackingNumber(
    credentials: Record<string, string>,
    payload: GittigidiyorTrackingPayload,
  ): Promise<void> {
    try {
      await withRateLimit(this.platform, this.rpm(), async () => {
        const data = await this.apiPost<GittigidiyorApiEnvelope>(
          '/trade/setTrackingNumber',
          credentials,
          {
            orderId: payload.orderId,
            trackingNumber: payload.trackingNumber,
            ...(payload.cargoCompany ? { cargoCompany: payload.cargoCompany } : {}),
          },
        );
        assertGgSuccess(data, 'kargo takip numarası');
      });
    } catch (error) {
      throwSyncFailed(
        this.platform,
        'setTrackingNumber',
        ggToApiError('kargo takip numarası', error),
      );
    }
  }
}
