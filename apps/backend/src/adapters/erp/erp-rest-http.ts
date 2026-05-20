import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { firstValueFrom } from 'rxjs';

import { axiosWithRetry } from '../../common/utils/http-retry';
import { CircuitBreakerOpenException } from '../common/rate-limit.exceptions';
import { PlatformHealthService } from '../common/platform-health.service';
import { isRecord, normalizeBaseUrl, resolveHostBaseUrl } from './erp-adapter.utils';

export const ERP_HTTP_TIMEOUT_MS = 30_000;
export const ERP_HTTP_MAX_RETRIES = 3;

export interface ErpRestAuthHeaders {
  Authorization?: string;
  'X-API-Key'?: string;
  'Content-Type': string;
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

interface LogoTigerTokenResponse {
  access_token?: string;
  token?: string;
  expires_in?: number;
  expiresAt?: string;
}

@Injectable()
export class ErpRestHttpService {
  private readonly logger = new Logger(ErpRestHttpService.name);
  private readonly tokenCache = new Map<string, TokenCacheEntry>();

  constructor(
    private readonly platformHealth: PlatformHealthService,
    private readonly httpService: HttpService,
  ) {}

  buildBaseUrl(credentials: Record<string, string>, apiPath: string): string {
    const host = resolveHostBaseUrl(credentials);
    const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    if (host.endsWith(path)) {
      return host;
    }
    if (host.includes(path)) {
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

  private logoTokenCacheKey(credentials: Record<string, string>): string {
    const base = resolveHostBaseUrl(credentials);
    return `${base}\0${credentials.username ?? ''}\0${credentials.clientId ?? ''}`;
  }

  /** Logo Tiger: POST /api/v1/token */
  async fetchLogoTigerToken(credentials: Record<string, string>): Promise<string> {
    const username = credentials.username?.trim();
    const password = credentials.password ?? '';
    const clientId = credentials.clientId?.trim() ?? credentials.client_id?.trim();
    if (!username || !password) {
      throw new Error('Logo Tiger: username ve password zorunludur');
    }
    if (!clientId) {
      throw new Error('Logo Tiger: clientId zorunludur');
    }

    const cacheKey = this.logoTokenCacheKey(credentials);
    const cached = this.tokenCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now + 5_000) {
      return cached.token;
    }

    const baseURL = this.buildBaseUrl(credentials, '/api/v1');
    const { data } = await firstValueFrom(
      this.httpService.post<LogoTigerTokenResponse>(
        '/token',
        { username, password, client_id: clientId },
        {
          baseURL,
          headers: { 'Content-Type': 'application/json' },
          timeout: ERP_HTTP_TIMEOUT_MS,
        },
      ),
    );

    const token = data.access_token ?? data.token ?? '';
    if (!token) {
      throw new Error('Logo Tiger: token alınamadı');
    }

    let expiresAt = now + 3_600_000;
    if (typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)) {
      expiresAt = now + data.expires_in * 1000 - 60_000;
    } else if (data.expiresAt) {
      const parsed = Date.parse(data.expiresAt);
      if (!Number.isNaN(parsed)) {
        expiresAt = parsed - 60_000;
      }
    }
    this.tokenCache.set(cacheKey, { token, expiresAt });
    return token;
  }

  resolveLogoTigerAuth(credentials: Record<string, string>): ErpRestAuthHeaders {
    const staticToken = credentials.token?.trim() ?? credentials.apiToken?.trim();
    if (staticToken) {
      return {
        Authorization: `Bearer ${staticToken}`,
        'Content-Type': 'application/json',
      };
    }
    return { 'Content-Type': 'application/json' };
  }

  createClient(baseURL: string, headers: ErpRestAuthHeaders): AxiosInstance {
    return axios.create({
      baseURL,
      headers: { ...headers },
      timeout: ERP_HTTP_TIMEOUT_MS,
    });
  }

  /** Logo Tiger REST istemcisi — 401'de token yeniler */
  async createLogoTigerClient(
    credentials: Record<string, string>,
    apiPath: string,
  ): Promise<AxiosInstance> {
    const baseURL = this.buildBaseUrl(credentials, apiPath);
    const staticToken = credentials.token?.trim() ?? credentials.apiToken?.trim();
    const client = axios.create({
      baseURL,
      headers: { 'Content-Type': 'application/json' },
      timeout: ERP_HTTP_TIMEOUT_MS,
    });

    const attachToken = async (
      config: InternalAxiosRequestConfig,
    ): Promise<InternalAxiosRequestConfig> => {
      const token =
        staticToken ?? (await this.fetchLogoTigerToken(credentials));
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    };

    client.interceptors.request.use(attachToken);

    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (
          !staticToken &&
          axios.isAxiosError(error) &&
          error.response?.status === 401 &&
          error.config &&
          !(error.config as InternalAxiosRequestConfig & { _retried?: boolean })
            ._retried
        ) {
          const cacheKey = this.logoTokenCacheKey(credentials);
          this.tokenCache.delete(cacheKey);
          const retryConfig = error.config as InternalAxiosRequestConfig & {
            _retried?: boolean;
          };
          retryConfig._retried = true;
          const token = await this.fetchLogoTigerToken(credentials);
          retryConfig.headers.Authorization = `Bearer ${token}`;
          return client.request(retryConfig);
        }
        return Promise.reject(error);
      },
    );

    return client;
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

  /** @deprecated normalizeBaseUrl için doğrudan resolveHostBaseUrl kullanın */
  resolveBaseUrlFromCredentials(credentials: Record<string, string>): string {
    return resolveHostBaseUrl(credentials);
  }
}

export function pickLogicalRef(row: Record<string, unknown>): number | null {
  const ref =
    row.LOGICALREF ??
    row.logicalref ??
    row.LogicalRef ??
    row.INTERNAL_REFERENCE ??
    row.internalReference ??
    row.id ??
    row.ID ??
    row.itemRef ??
    row.ItemRef;
  const num = Number(ref);
  return Number.isFinite(num) ? num : null;
}

export function pickCode(row: Record<string, unknown>): string {
  const raw =
    row.CODE ??
    row.code ??
    row.Code ??
    row.stokKod ??
    row.StokKod ??
    row.ItemCode ??
    row.itemCode;
  return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
}

export function pickName(row: Record<string, unknown>, fallback: string): string {
  const raw =
    row.NAME ??
    row.name ??
    row.DESCRIPTION ??
    row.description ??
    row.stokAdi ??
    row.StokAdi ??
    row.ItemName ??
    row.itemName;
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
