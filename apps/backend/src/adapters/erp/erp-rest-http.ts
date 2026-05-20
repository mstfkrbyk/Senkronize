import { Injectable } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { CircuitBreakerOpenException } from '../common/rate-limit.exceptions';
import { PlatformHealthService } from '../common/platform-health.service';
import { isRecord, normalizeBaseUrl } from './erp-adapter.utils';

export const ERP_HTTP_TIMEOUT_MS = 5_000;
export const ERP_HTTP_MAX_RETRIES = 3;

export interface ErpRestAuthHeaders {
  Authorization?: string;
  'X-API-Key'?: string;
  'Content-Type': string;
}

@Injectable()
export class ErpRestHttpService {
  constructor(private readonly platformHealth: PlatformHealthService) {}

  buildBaseUrl(credentials: Record<string, string>, apiPath: string): string {
    const host = normalizeBaseUrl(credentials.baseUrl ?? '');
    if (!host) {
      throw new Error('ERP: baseUrl zorunludur');
    }
    const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    if (host.endsWith(path)) {
      return host;
    }
    return `${host}${path}`;
  }

  resolveBasicOrBearerAuth(credentials: Record<string, string>): ErpRestAuthHeaders {
    const token =
      credentials.apiKey?.trim() ||
      credentials.apiToken?.trim() ||
      credentials.token?.trim();
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }
    const username = credentials.username?.trim();
    const password = credentials.password ?? '';
    if (username && password) {
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      return {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      };
    }
    throw new Error('ERP: apiKey/token veya username/password zorunludur');
  }

  resolveMikroAuth(credentials: Record<string, string>): ErpRestAuthHeaders {
    const apiKey = credentials.apiKey?.trim();
    if (apiKey) {
      return {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      };
    }
    return this.resolveBasicOrBearerAuth(credentials);
  }

  createClient(baseURL: string, headers: ErpRestAuthHeaders): AxiosInstance {
    return axios.create({
      baseURL,
      headers: { ...headers },
      timeout: ERP_HTTP_TIMEOUT_MS,
    });
  }

  async request<T>(
    platformKey: string,
    organizationId: string,
    config: AxiosRequestConfig,
  ): Promise<T> {
    await this.platformHealth.checkCircuitBreaker(platformKey, organizationId);
    try {
      const data = await axiosWithRetry<T>(config, {
        maxRetries: ERP_HTTP_MAX_RETRIES,
        backoffMs: 500,
      });
      await this.platformHealth.recordSuccess(platformKey, organizationId);
      return data;
    } catch (error) {
      const unreachable =
        axios.isAxiosError(error) &&
        (error.code === 'ECONNABORTED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT');
      if (unreachable || error instanceof CircuitBreakerOpenException) {
        await this.platformHealth.recordError(platformKey, organizationId);
      } else if (axios.isAxiosError(error) && error.response && error.response.status >= 500) {
        await this.platformHealth.recordError(platformKey, organizationId);
      }
      throw error;
    }
  }
}

export function pickLogicalRef(row: Record<string, unknown>): number | null {
  const ref =
    row.LOGICALREF ??
    row.logicalref ??
    row.LogicalRef ??
    row.id ??
    row.ID;
  const num = Number(ref);
  return Number.isFinite(num) ? num : null;
}

export function pickCode(row: Record<string, unknown>): string {
  const raw = row.CODE ?? row.code ?? row.Code ?? row.stokKod ?? row.StokKod;
  return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
}

export function pickName(row: Record<string, unknown>, fallback: string): string {
  const raw =
    row.NAME ??
    row.name ??
    row.DESCRIPTION ??
    row.description ??
    row.stokAdi ??
    row.StokAdi;
  const name = typeof raw === 'string' ? raw.trim() : '';
  return name || fallback;
}

export function rowsFromPayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }
  if (!isRecord(data)) {
    return [];
  }
  for (const key of ['items', 'value', 'data', 'results', 'liste', 'stoklar']) {
    const chunk = data[key];
    if (Array.isArray(chunk)) {
      return chunk.filter(isRecord);
    }
  }
  return [];
}
