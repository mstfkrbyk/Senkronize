import { createHash } from 'crypto';

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosRequestHeaders,
  type InternalAxiosRequestConfig,
  isAxiosError,
} from 'axios';

import type { CacheService } from '../../common/cache/cache.service';
import { CACHE_TTL } from '../../common/cache/cache-ttl';
import { AMAZON_LWA_URL } from './amazon.constants';
import { signAmazonSpApiRequest } from './amazon-sp-api-sigv4';
import {
  amazonResolveAwsCredentials,
  amazonResolveLwaCredentials,
} from './amazon-sp-api.credentials';
import type { AmazonLwaTokenResponse } from './amazon.types';

/** Modül başlatıldığında Redis önbelleği bağlanır (opsiyonel). */
let amazonSpApiCache: CacheService | null = null;

export function configureAmazonSpApiCache(cache: CacheService): void {
  amazonSpApiCache = cache;
}

function lwaCacheKey(clientId: string, refreshToken: string): string {
  const digest = createHash('sha256')
    .update(`${clientId}:${refreshToken}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return `amazon:lwa:${digest}`;
}

/**
 * Amazon SP-API kimlik doğrulama: LWA OAuth2 + AWS SigV4 imzalama.
 */
export class AmazonSpApiAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly cache: CacheService | null;
  private readonly spBaseUrl: string;
  private readonly awsRegion: string;

  constructor(
    credentials: Record<string, string>,
    spBaseUrl: string,
    awsRegion = 'eu-west-1',
    cache: CacheService | null = amazonSpApiCache,
  ) {
    const lwa = amazonResolveLwaCredentials(credentials);
    const aws = amazonResolveAwsCredentials(credentials);
    this.clientId = lwa.clientId;
    this.clientSecret = lwa.clientSecret;
    this.accessKeyId = aws.accessKeyId;
    this.secretAccessKey = aws.secretAccessKey;
    this.cache = cache;
    this.spBaseUrl = spBaseUrl;
    this.awsRegion = awsRegion;
  }

  /** LWA refresh_token ile access token alır; Redis'te 55 dk önbelleklenir. */
  async getAccessToken(refreshToken: string): Promise<string> {
    const trimmed = refreshToken.trim();
    if (trimmed.length === 0) {
      throw new Error('Amazon: refreshToken zorunludur');
    }

    const cacheKey = lwaCacheKey(this.clientId, trimmed);
    if (this.cache) {
      const cached = await this.cache.get<string>(cacheKey);
      if (typeof cached === 'string' && cached.length > 0) {
        return cached;
      }
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: trimmed,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    try {
      const { data } = await axios.post<AmazonLwaTokenResponse>(AMAZON_LWA_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20_000,
      });
      if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
        throw new Error('Amazon LWA yanıtında access_token yok');
      }
      if (this.cache) {
        await this.cache.set(cacheKey, data.access_token, CACHE_TTL.AMAZON_LWA_TOKEN);
      }
      return data.access_token;
    } catch (error) {
      throw amazonAuthToApiError('LWA token', error);
    }
  }

  /** Mevcut LWA access token ile SP-API isteğini AWS SigV4 ile imzalar. */
  signRequest(
    request: AxiosRequestConfig,
    accessToken: string,
  ): AxiosRequestConfig {
    const config = { ...request } as InternalAxiosRequestConfig;
    const existing = config.headers ?? {};
    config.headers = {
      ...existing,
      'x-amz-access-token': accessToken,
      'Content-Type':
        (existing as Record<string, string>)['Content-Type'] ?? 'application/json',
    } as unknown as AxiosRequestHeaders;
    return signAmazonSpApiRequest(
      config,
      this.accessKeyId,
      this.secretAccessKey,
      this.spBaseUrl,
      this.awsRegion,
    );
  }

  /** İmzalı axios istemcisi oluşturur. */
  createSignedClient(accessToken: string): AxiosInstance {
    const client = axios.create({
      baseURL: this.spBaseUrl,
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
    client.interceptors.request.use((config) =>
      this.signRequest(config, accessToken) as InternalAxiosRequestConfig,
    );
    return client;
  }

  /** credentials içindeki refreshToken ile token alır. */
  async getAccessTokenFromCredentials(
    credentials: Record<string, string>,
  ): Promise<string> {
    const { refreshToken } = amazonResolveLwaCredentials(credentials);
    return this.getAccessToken(refreshToken);
  }
}

function amazonAuthToApiError(context: string, error: unknown): Error {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    let detail = error.message;
    if (typeof data === 'object' && data !== null) {
      const errors = (data as { errors?: Array<{ message?: string }> }).errors;
      if (Array.isArray(errors) && errors[0]?.message) {
        detail = errors[0].message;
      } else if ('message' in data && typeof data.message === 'string') {
        detail = data.message;
      }
    }
    return new Error(
      `Amazon SP-API ${context}${status != null ? ` (${String(status)})` : ''}: ${detail}`,
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(`Amazon SP-API ${context}: Bilinmeyen hata`);
}
