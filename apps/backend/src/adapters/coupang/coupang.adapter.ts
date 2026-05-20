import { Injectable, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import type { AxiosRequestConfig } from 'axios';
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
  MarketplaceTokenCache,
  marketplaceTokenCacheKey,
} from '../common/marketplace-token-cache';
import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';
import { isRecord, parseMoney, throwSyncFailed } from '../stub-helpers';
import { coupangHmac } from './coupang.sign';
import type {
  CoupangOrderItemRow,
  CoupangOrdersheetRow,
  CoupangProductOptionRow,
  CoupangProductRow,
} from './coupang.types';

const COUPANG_BASE = 'https://api-gateway.coupang.com/v2';
const COUPANG_TOKEN_SENTINEL = 'hmac';

@Injectable()
export class CoupangAdapter implements IMarketplaceAdapter {
  readonly platform = 'COUPANG';
  private readonly logger = new Logger(CoupangAdapter.name);

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly tokenCache: MarketplaceTokenCache,
  ) {
    void this.encryptionService;
  }

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.COUPANG ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private requireKeys(credentials: Record<string, string>): {
    accessKey: string;
    secretKey: string;
    vendorId: string;
  } {
    const accessKey =
      credentials.accessKey?.trim() ?? credentials.apiKey?.trim() ?? '';
    const secretKey =
      credentials.secretKey?.trim() ??
      credentials.apiSecret?.trim() ??
      '';
    const vendorId =
      credentials.vendorId?.trim() ??
      credentials.sellerId?.trim() ??
      credentials.supplierId?.trim() ??
      '';
    if (!accessKey || !secretKey) {
      throw new Error(
        'Coupang: accessKey ve secretKey (veya apiKey/apiSecret) zorunludur',
      );
    }
    if (!vendorId) {
      throw new Error('Coupang: vendorId (veya sellerId/supplierId) zorunludur');
    }
    return { accessKey, secretKey, vendorId };
  }

  private tokenKey(accessKey: string, vendorId: string): string {
    return marketplaceTokenCacheKey(
      this.platform,
      `${accessKey}:${vendorId}`,
    );
  }

  private async ensureAuthSession(
    credentials: Record<string, string>,
    forceRefresh = false,
  ): Promise<{ accessKey: string; secretKey: string }> {
    const { accessKey, secretKey, vendorId } = this.requireKeys(credentials);
    const cacheKey = this.tokenKey(accessKey, vendorId);
    if (!forceRefresh) {
      const cached = await this.tokenCache.get(cacheKey);
      if (cached === COUPANG_TOKEN_SENTINEL) {
        return { accessKey, secretKey };
      }
    } else {
      await this.tokenCache.invalidate(cacheKey);
    }
    await this.tokenCache.set(cacheKey, COUPANG_TOKEN_SENTINEL);
    return { accessKey, secretKey };
  }

  private authHeaders(
    accessKey: string,
    secretKey: string,
    method: string,
    path: string,
  ): Pick<AxiosRequestConfig, 'headers'> {
    return {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: coupangHmac(method, path, accessKey, secretKey),
      },
    };
  }

  private splitProductOption(barcode: string): {
    sellerProductId: string;
    vendorItemId: string;
  } {
    const sep = barcode.includes('|') ? '|' : barcode.includes(':') ? ':' : null;
    if (sep) {
      const [sellerProductId, vendorItemId] = barcode.split(sep, 2);
      return {
        sellerProductId: sellerProductId.trim(),
        vendorItemId: (vendorItemId ?? '').trim(),
      };
    }
    const id = barcode.trim();
    return { sellerProductId: id, vendorItemId: id };
  }

  private async request<T>(
    credentials: Record<string, string>,
    method: 'GET' | 'PUT' | 'POST',
    path: string,
    params: Record<string, string> = {},
    body?: Record<string, unknown>,
  ): Promise<T> {
    const execute = async (forceRefresh: boolean): Promise<T> => {
      const { accessKey, secretKey } = await this.ensureAuthSession(
        credentials,
        forceRefresh,
      );
      const queryString = Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&');
      const url =
        queryString.length > 0
          ? `${COUPANG_BASE}${path}?${queryString}`
          : `${COUPANG_BASE}${path}`;
      let data: unknown;
      await withRateLimit(this.platform, this.rpm(), async () => {
        data = await axiosWithRetry<unknown>(
          {
            method,
            url,
            timeout: 25_000,
            data: body,
            ...this.authHeaders(accessKey, secretKey, method, path),
          },
          { retryOn: [429, 500, 502, 503, 504] },
        );
      });
      if (isRecord(data) && data.code === 'ERROR') {
        const msg =
          typeof data.message === 'string' ? data.message : 'Coupang API hatası';
        throw new Error(msg);
      }
      return (isRecord(data) && 'data' in data ? data.data : data) as T;
    };

    try {
      return await execute(false);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        return await execute(true);
      }
      throw error;
    }
  }

  private ensureArray<T>(v: T | T[] | undefined): T[] {
    if (v === undefined) {
      return [];
    }
    return Array.isArray(v) ? v : [v];
  }

  private mapOrder(
    sheet: CoupangOrdersheetRow,
    items: CoupangOrderItemRow[],
  ): MarketplaceOrder | null {
    const idRaw = sheet.orderId ?? sheet.shipmentBoxId;
    if (idRaw === undefined || idRaw === null) {
      return null;
    }
    const name =
      typeof sheet.orderer?.name === 'string' && sheet.orderer.name.length > 0
        ? sheet.orderer.name
        : typeof sheet.receiver?.name === 'string' && sheet.receiver.name.length > 0
          ? sheet.receiver.name
          : '—';
    const lines =
      items.length > 0 ? items : this.ensureArray(sheet.orderItems);
    const createdRaw = sheet.orderedAt ?? sheet.paidAt;
    const createdAt =
      typeof createdRaw === 'string' && createdRaw.length > 0
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
    let total = 0;
    const mappedItems = lines.map((l) => {
      const price = parseMoney(l.orderPrice ?? l.salesPrice);
      const qty =
        typeof l.shippingCount === 'number' && Number.isFinite(l.shippingCount)
          ? Math.max(0, Math.round(l.shippingCount))
          : 1;
      total += price * qty;
      const sku =
        typeof l.externalVendorSku === 'string'
          ? l.externalVendorSku
          : String(l.vendorItemId ?? l.sellerProductItemId ?? '');
      return {
        sku,
        barcode: sku,
        quantity: qty,
        unitPrice: price,
        platformItemId: String(
          l.vendorItemId ?? l.sellerProductItemId ?? sku,
        ),
        productName:
          typeof l.sellerProductName === 'string'
            ? l.sellerProductName
            : undefined,
      };
    });
    return {
      platformOrderId: String(idRaw),
      status: typeof sheet.status === 'string' ? sheet.status : 'ACCEPT',
      customerName: name,
      items: mappedItems,
      totalAmount: total,
      currency: 'KRW',
      createdAt,
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { vendorId } = this.requireKeys(credentials);
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 1);
      const path = `/vendors/${vendorId}/ordersheets`;
      await this.request<unknown>(credentials, 'GET', path, {
        createdAtFrom: start.toISOString(),
        createdAtTo: end.toISOString(),
        status: 'ACCEPT',
        maxPerPage: '1',
      });
      return true;
    } catch (error) {
      this.logger.warn('Coupang bağlantı testi başarısız', {
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
      const { vendorId } = this.requireKeys(credentials);
      const end = new Date();
      const start = since ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const path = `/vendors/${vendorId}/ordersheets`;
      const raw = await this.request<
        CoupangOrdersheetRow[] | { content?: CoupangOrdersheetRow[] }
      >(credentials, 'GET', path, {
        createdAtFrom: start.toISOString(),
        createdAtTo: end.toISOString(),
        status: 'ACCEPT',
      });
      const sheets = Array.isArray(raw)
        ? raw
        : this.ensureArray(isRecord(raw) ? raw.content : undefined);
      const orders: MarketplaceOrder[] = [];
      for (const sheet of sheets) {
        const orderId = sheet.orderId;
        let items: CoupangOrderItemRow[] = this.ensureArray(sheet.orderItems);
        if (orderId !== undefined && orderId !== null && items.length === 0) {
          const detailPath = `/vendors/${vendorId}/ordersheets/${String(orderId)}/items`;
          const detailRaw = await this.request<
            CoupangOrderItemRow[] | { orderItems?: CoupangOrderItemRow[] }
          >(credentials, 'GET', detailPath);
          items = Array.isArray(detailRaw)
            ? detailRaw
            : this.ensureArray(
                isRecord(detailRaw) ? detailRaw.orderItems : undefined,
              );
        }
        const mapped = this.mapOrder(sheet, items);
        if (mapped) {
          orders.push(mapped);
        }
      }
      return orders;
    } catch (error) {
      throwSyncFailed('COUPANG', 'getOrders', error);
    }
  }

  async getListings(
    credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    try {
      const { vendorId } = this.requireKeys(credentials);
      const path = `/vendors/${vendorId}/products`;
      const raw = await this.request<
        CoupangProductRow[] | { data?: CoupangProductRow[]; products?: CoupangProductRow[] }
      >(credentials, 'GET', path, {
        page: String(page),
        size: '50',
      });
      const products = Array.isArray(raw)
        ? raw
        : this.ensureArray(
            isRecord(raw) ? raw.data ?? raw.products : undefined,
          );
      const items: MarketplaceListing[] = [];
      for (const product of products) {
        const productId = String(product.sellerProductId ?? '');
        const options = this.ensureArray(product.items);
        if (options.length === 0) {
          items.push({
            platformProductId: productId,
            barcode: productId,
            title:
              typeof product.sellerProductName === 'string'
                ? product.sellerProductName
                : productId,
            quantity: 0,
            salePrice: 0,
            listPrice: 0,
            approved: true,
            images: [],
          });
          continue;
        }
        for (const opt of options) {
          items.push(this.mapListingOption(product, opt));
        }
      }
      return {
        items,
        total: items.length,
        page,
        pageSize: 50,
      };
    } catch (error) {
      throwSyncFailed('COUPANG', 'getListings', error);
    }
  }

  private mapListingOption(
    product: CoupangProductRow,
    opt: CoupangProductOptionRow,
  ): MarketplaceListing {
    const productId = String(product.sellerProductId ?? '');
    const optionId = String(
      opt.sellerProductItemId ?? opt.vendorItemId ?? productId,
    );
    const sku =
      typeof opt.externalVendorSku === 'string'
        ? opt.externalVendorSku
        : `${productId}|${optionId}`;
    const sale = parseMoney(opt.salePrice);
    const list = parseMoney(opt.originalPrice ?? opt.salePrice);
    const qty =
      typeof opt.maximumBuyCount === 'number' && Number.isFinite(opt.maximumBuyCount)
        ? Math.max(0, Math.round(opt.maximumBuyCount))
        : 0;
    return {
      platformProductId: productId,
      barcode: sku.includes('|') ? sku : `${productId}|${optionId}`,
      title:
        typeof product.sellerProductName === 'string'
          ? product.sellerProductName
          : productId,
      quantity: qty,
      salePrice: sale,
      listPrice: list,
      approved: true,
      images: [],
    };
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdatePayload[],
  ): Promise<void> {
    try {
      const { vendorId } = this.requireKeys(credentials);
      for (const u of updates) {
        const { sellerProductId, vendorItemId } = this.splitProductOption(u.barcode);
        const path = `/vendors/${vendorId}/products/${sellerProductId}/items/${vendorItemId}`;
        await this.request<unknown>(credentials, 'PUT', path, {}, {
          maximumBuyCount: Math.max(0, u.quantity),
        });
      }
    } catch (error) {
      throwSyncFailed('COUPANG', 'updateStock', error);
    }
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdatePayload[],
  ): Promise<void> {
    try {
      const { vendorId } = this.requireKeys(credentials);
      for (const u of updates) {
        const { sellerProductId, vendorItemId } = this.splitProductOption(u.barcode);
        const path = `/vendors/${vendorId}/products/${sellerProductId}/items/${vendorItemId}`;
        await this.request<unknown>(credentials, 'PUT', path, {}, {
          salePrice: u.salePrice,
        });
      }
    } catch (error) {
      throwSyncFailed('COUPANG', 'updatePrice', error);
    }
  }

  async shipOrder(
    credentials: Record<string, string>,
    payload: {
      orderSheetId: string;
      deliveryCompanyCode: string;
      invoiceNumber: string;
    },
  ): Promise<void> {
    try {
      const { vendorId } = this.requireKeys(credentials);
      const path = `/vendors/${vendorId}/ordersheets/${payload.orderSheetId}/shipments`;
      await this.request<unknown>(credentials, 'PUT', path, {}, {
        deliveryCompanyCode: payload.deliveryCompanyCode,
        invoiceNumber: payload.invoiceNumber,
      });
    } catch (error) {
      throwSyncFailed('COUPANG', 'shipOrder', error);
    }
  }
}
