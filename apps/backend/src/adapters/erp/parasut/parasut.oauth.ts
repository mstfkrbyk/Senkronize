import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../common/cache/cache.service';
import { CACHE_TTL } from '../../../common/cache/cache-ttl';
import { axiosWithRetry } from '../../../common/utils/http-retry';

import { PARASUT_AUTH_URL } from './parasut.constants';
import type { ParasutTokenResponse } from './parasut.types';

interface MemoryTokenEntry {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

const memoryTokens = new Map<string, MemoryTokenEntry>();

function tokenCacheKey(credentials: Record<string, string>): string {
  const seed = [
    credentials.clientId ?? '',
    credentials.companyId ?? '',
    credentials.username ?? '',
  ].join(':');
  const digest = createHash('sha256').update(`parasut:${seed}`, 'utf8').digest('hex').slice(0, 32);
  return `erp:token:parasut:${digest}`;
}

function refreshCacheKey(accessKey: string): string {
  return `${accessKey}:refresh`;
}

@Injectable()
export class ParasutOAuthService {
  constructor(private readonly cache: CacheService) {}

  async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('Paraşüt: clientId ve clientSecret zorunludur');
    }

    const cacheKey = tokenCacheKey(credentials);
    const mem = memoryTokens.get(cacheKey);
    if (mem && mem.expiresAt > Date.now() + 5_000) {
      return mem.accessToken;
    }

    const cachedAccess = await this.cache.get<string>(cacheKey);
    if (typeof cachedAccess === 'string' && cachedAccess.length > 0) {
      memoryTokens.set(cacheKey, {
        accessToken: cachedAccess,
        expiresAt: Date.now() + CACHE_TTL.MARKETPLACE_ACCESS_TOKEN * 1000,
      });
      return cachedAccess;
    }

    const storedRefresh =
      credentials.refreshToken?.trim() ||
      (await this.cache.get<string>(refreshCacheKey(cacheKey))) ||
      undefined;

    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
    });

    if (storedRefresh) {
      body.set('grant_type', 'refresh_token');
      body.set('refresh_token', storedRefresh);
    } else {
      body.set('grant_type', username && password ? 'password' : 'client_credentials');
      if (username && password) {
        body.set('username', username);
        body.set('password', password);
      }
    }

    const data = await axiosWithRetry<ParasutTokenResponse>(
      {
        method: 'POST',
        url: PARASUT_AUTH_URL,
        data: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20_000,
      },
      { maxRetries: 2 },
    );

    const ttlSec = Math.max(data.expires_in - 60, 60);
    const entry: MemoryTokenEntry = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + ttlSec * 1000,
    };
    memoryTokens.set(cacheKey, entry);
    await this.cache.set(cacheKey, data.access_token, ttlSec);

    if (data.refresh_token) {
      await this.cache.set(refreshCacheKey(cacheKey), data.refresh_token, CACHE_TTL.PLAN_LIMITS);
    }

    return data.access_token;
  }

  async invalidate(credentials: Record<string, string>): Promise<void> {
    const cacheKey = tokenCacheKey(credentials);
    memoryTokens.delete(cacheKey);
    await this.cache.del(cacheKey);
    await this.cache.del(refreshCacheKey(cacheKey));
  }
}
