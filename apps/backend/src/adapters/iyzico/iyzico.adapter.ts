import { createHmac, randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import type {
  IMarketplaceAdapter,
  MarketplaceListing,
  MarketplaceOrder,
  PaginatedResult,
  PriceUpdatePayload,
  StockUpdatePayload,
} from '@senkronize/shared';
import axios from 'axios';

import {
  axiosWithRetry,
  PLATFORM_RATE_LIMITS,
  withRateLimit,
} from '../../common/utils/http-retry';

const IYZICO_BASE = 'https://api.iyzipay.com';

function iyzicoHeaders(
  apiKey: string,
  secretKey: string,
  uriPath: string,
  body: string,
): Record<string, string> {
  const randomKey = randomBytes(8).toString('hex');
  const signature = createHmac('sha256', secretKey)
    .update(randomKey + uriPath + body)
    .digest('hex');
  const token = Buffer.from(`${apiKey}:${signature}`, 'utf8').toString('base64');
  return {
    Authorization: `IYZWSv2 ${token}`,
    'x-iyzi-rnd': randomKey,
    'Content-Type': 'application/json',
  };
}

@Injectable()
export class IyzicoAdapter implements IMarketplaceAdapter {
  readonly platform = 'IYZICO';
  private readonly logger = new Logger(IyzicoAdapter.name);

  private rpm(): number {
    return PLATFORM_RATE_LIMITS.IYZICO ?? PLATFORM_RATE_LIMITS.DEFAULT;
  }

  private base(credentials: Record<string, string>): string {
    return (credentials.baseUrl?.trim() || IYZICO_BASE).replace(/\/+$/, '');
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    const apiKey = credentials.apiKey?.trim();
    const secretKey = credentials.secretKey?.trim();
    if (!apiKey || !secretKey) {
      return false;
    }
    const path = '/payment/detail';
    const body = JSON.stringify({
      locale: 'tr',
      conversationId: `senkronize-${Date.now()}`,
      paymentId: credentials.paymentId?.trim() || '0',
    });
    try {
      await withRateLimit(this.platform, this.rpm(), async () => {
        await axiosWithRetry<unknown>(
          {
            method: 'POST',
            url: `${this.base(credentials)}${path}`,
            data: body,
            headers: iyzicoHeaders(apiKey, secretKey, path, body),
            timeout: 15_000,
          },
          { maxRetries: 1 },
        );
      });
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        return true;
      }
      this.logger.warn('İyzico bağlantı testi başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return false;
    }
  }

  async getOrders(
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<MarketplaceOrder[]> {
    const apiKey = credentials.apiKey?.trim();
    const secretKey = credentials.secretKey?.trim();
    if (!apiKey || !secretKey) {
      return [];
    }
    const path = '/reporting/payment/list';
    const body = JSON.stringify({
      locale: 'tr',
      conversationId: `senkronize-${Date.now()}`,
      date: since ? since.toISOString().split('T')[0] : undefined,
    });
    try {
      const data = await withRateLimit(this.platform, this.rpm(), async () => {
        return await axiosWithRetry<{ payments?: unknown[] }>(
          {
            method: 'POST',
            url: `${this.base(credentials)}${path}`,
            data: body,
            headers: iyzicoHeaders(apiKey, secretKey, path, body),
            timeout: 20_000,
          },
          {},
        );
      });
      const rows = Array.isArray(data.payments) ? data.payments : [];
      return rows.map((row, i) => {
        const p =
          typeof row === 'object' && row !== null
            ? (row as Record<string, unknown>)
            : {};
        const id = String(p.paymentId ?? p.id ?? `pay-${i}`);
        return {
          platformOrderId: id,
          status: String(p.paymentStatus ?? p.status ?? 'UNKNOWN'),
          customerName: '—',
          items: [],
          totalAmount: Number(p.price ?? p.paidPrice ?? 0) || 0,
          currency: String(p.currency ?? 'TRY'),
          createdAt: new Date(
            typeof p.createdDate === 'string' ? p.createdDate : Date.now(),
          ).toISOString(),
        };
      });
    } catch (error) {
      this.logger.warn('İyzico ödeme listesi alınamadı', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return [];
    }
  }

  async getListings(
    _credentials: Record<string, string>,
    page = 0,
  ): Promise<PaginatedResult<MarketplaceListing>> {
    return { items: [], total: 0, page, pageSize: 50 };
  }

  async updateStock(
    _credentials: Record<string, string>,
    _updates: StockUpdatePayload[],
  ): Promise<void> {
    return;
  }

  async updatePrice(
    _credentials: Record<string, string>,
    _updates: PriceUpdatePayload[],
  ): Promise<void> {
    return;
  }
}
