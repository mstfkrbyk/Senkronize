import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { CacheService } from '../../../common/cache/cache.service';
import { IntegrationPolicyService } from '../../../integration-policy/integration-policy.service';
import {
  PlatformActivityLogService,
  type PlatformActivityLevel,
} from '../../../monitoring/platform-activity-log.service';

import {
  BIZIMHESAP_MAX_REQUESTS_PER_HOUR,
  BIZIMHESAP_MIN_SYNC_INTERVAL_MS,
} from './bizimhesap.constants';
import { BizimHesapRateLimitBlockedException } from './bizimhesap-rate-limit.exceptions';

const PLATFORM = 'BIZIMHESAP';
const DEFAULT_COOLDOWN_SEC = 3600;

export interface BizimHesapRateLimitStatus {
  organizationId: string;
  blocked: boolean;
  blockedUntil: string | null;
  retryAfterSeconds: number;
  reason: string | null;
  requestsThisHour: number;
  maxRequestsPerHour: number;
  minSyncIntervalMs: number;
}

interface CooldownState {
  blockedUntil: string;
  reason: string;
}

interface MemoryOrgState {
  cooldown: CooldownState | null;
  hourKey: string;
  requestCount: number;
}

function hourKeyFor(date = new Date()): string {
  return date.toISOString().slice(0, 13);
}

function parseRetryAfterSeconds(header: unknown): number {
  if (header === undefined || header === null) {
    return DEFAULT_COOLDOWN_SEC;
  }
  const raw = Array.isArray(header) ? header[0] : header;
  const parsed = parseInt(String(raw), 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_COOLDOWN_SEC;
}

function retryAfterFromError(error: unknown): number {
  if (axios.isAxiosError(error)) {
    return parseRetryAfterSeconds(error.response?.headers?.['retry-after']);
  }
  if (error instanceof Error && error.message.includes('429')) {
    return DEFAULT_COOLDOWN_SEC;
  }
  return DEFAULT_COOLDOWN_SEC;
}

@Injectable()
export class BizimHesapRateLimitService {
  private readonly logger = new Logger(BizimHesapRateLimitService.name);
  private readonly memory = new Map<string, MemoryOrgState>();

  constructor(
    private readonly cache: CacheService,
    private readonly integrationPolicy: IntegrationPolicyService,
    private readonly activityLog: PlatformActivityLogService,
  ) {}

  async assertCanRequest(organizationId: string): Promise<void> {
    const status = await this.getStatus(organizationId);
    if (!status.blocked) {
      return;
    }
    throw new BizimHesapRateLimitBlockedException(
      organizationId,
      new Date(status.blockedUntil ?? Date.now()),
      status.retryAfterSeconds,
      status.reason ??
        'BizimHesap API istek limiti aktif. Bekleme süresi dolana kadar yeni istek gönderilmez.',
    );
  }

  async isBlocked(organizationId: string): Promise<boolean> {
    const status = await this.getStatus(organizationId);
    return status.blocked;
  }

  async getStatus(organizationId: string): Promise<BizimHesapRateLimitStatus> {
    const maxRequestsPerHour = await this.resolveMaxRequestsPerHour();
    const minSyncIntervalMs = await this.resolveMinSyncIntervalMs();
    const cooldown = await this.readCooldown(organizationId);
    const requestsThisHour = await this.readHourlyCount(organizationId);
    const now = Date.now();

    if (cooldown) {
      const blockedUntilMs = new Date(cooldown.blockedUntil).getTime();
      if (blockedUntilMs > now) {
        return {
          organizationId,
          blocked: true,
          blockedUntil: cooldown.blockedUntil,
          retryAfterSeconds: Math.max(1, Math.ceil((blockedUntilMs - now) / 1000)),
          reason: cooldown.reason,
          requestsThisHour,
          maxRequestsPerHour,
          minSyncIntervalMs,
        };
      }
      await this.clearCooldown(organizationId);
    }

    if (requestsThisHour >= maxRequestsPerHour) {
      const blockedUntil = this.nextHourBoundary();
      await this.setCooldown(
        organizationId,
        blockedUntil,
        `Saatlik istek kotası doldu (${String(requestsThisHour)}/${String(maxRequestsPerHour)})`,
        false,
      );
      return {
        organizationId,
        blocked: true,
        blockedUntil: blockedUntil.toISOString(),
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((blockedUntil.getTime() - now) / 1000),
        ),
        reason: `Saatlik istek kotası doldu (${String(requestsThisHour)}/${String(maxRequestsPerHour)})`,
        requestsThisHour,
        maxRequestsPerHour,
        minSyncIntervalMs,
      };
    }

    return {
      organizationId,
      blocked: false,
      blockedUntil: null,
      retryAfterSeconds: 0,
      reason: null,
      requestsThisHour,
      maxRequestsPerHour,
      minSyncIntervalMs,
    };
  }

  async recordSuccessfulRequest(
    organizationId: string,
    path: string,
    method: string,
  ): Promise<void> {
    const count = await this.incrementHourlyCount(organizationId);
    await this.log(organizationId, 'INFO', 'api.request', `${method} ${path}`, {
      path,
      method,
      requestsThisHour: count,
    });
  }

  async record429(
    organizationId: string,
    error: unknown,
    path: string,
    method: string,
  ): Promise<void> {
    const retryAfterSeconds = retryAfterFromError(error);
    const blockedUntil = new Date(Date.now() + retryAfterSeconds * 1000);
    await this.setCooldown(
      organizationId,
      blockedUntil,
      `BizimHesap 429 — ${method} ${path}`,
      true,
    );
    await this.log(
      organizationId,
      'ERROR',
      'api.429',
      `BizimHesap istek limiti (429). ${String(retryAfterSeconds)} sn bekleniyor.`,
      { path, method, retryAfterSeconds, blockedUntil: blockedUntil.toISOString() },
    );
    void this.rateLimitMonitorRecord(organizationId, retryAfterSeconds);
  }

  async recordSyncSkipped(organizationId: string, reason: string): Promise<void> {
    await this.log(organizationId, 'WARN', 'sync.skipped', reason);
  }

  async clearCooldown(organizationId: string): Promise<void> {
    await this.cache.del(this.cooldownKey(organizationId));
    const mem = this.memory.get(organizationId);
    if (mem) {
      mem.cooldown = null;
    }
  }

  private async setCooldown(
    organizationId: string,
    blockedUntil: Date,
    reason: string,
    logBlocked: boolean,
  ): Promise<void> {
    const ttlSec = Math.max(
      60,
      Math.ceil((blockedUntil.getTime() - Date.now()) / 1000) + 30,
    );
    const state: CooldownState = {
      blockedUntil: blockedUntil.toISOString(),
      reason,
    };
    await this.cache.set(this.cooldownKey(organizationId), state, ttlSec);
    const mem = this.memoryOrg(organizationId);
    mem.cooldown = state;

    if (logBlocked) {
      await this.log(
        organizationId,
        'WARN',
        'rate_limit.blocked',
        reason,
        { blockedUntil: state.blockedUntil },
      );
    }
  }

  private async readCooldown(organizationId: string): Promise<CooldownState | null> {
    const cached = await this.cache.get<CooldownState>(this.cooldownKey(organizationId));
    if (cached) {
      return cached;
    }
    return this.memoryOrg(organizationId).cooldown;
  }

  private async incrementHourlyCount(organizationId: string): Promise<number> {
    const key = hourKeyFor();
    const cacheKey = this.hourlyKey(organizationId, key);
    const mem = this.memoryOrg(organizationId);
    if (mem.hourKey !== key) {
      mem.hourKey = key;
      mem.requestCount = 0;
    }
    mem.requestCount += 1;

    const current = await this.cache.get<{ count: number }>(cacheKey);
    const next = (current?.count ?? mem.requestCount - 1) + 1;
    await this.cache.set(cacheKey, { count: next }, 7200);
    mem.requestCount = next;
    return next;
  }

  private async readHourlyCount(organizationId: string): Promise<number> {
    const key = hourKeyFor();
    const cacheKey = this.hourlyKey(organizationId, key);
    const cached = await this.cache.get<{ count: number }>(cacheKey);
    if (cached?.count !== undefined) {
      return cached.count;
    }
    const mem = this.memory.get(organizationId);
    if (mem?.hourKey === key) {
      return mem.requestCount;
    }
    return 0;
  }

  private memoryOrg(organizationId: string): MemoryOrgState {
    const existing = this.memory.get(organizationId);
    if (existing) {
      return existing;
    }
    const created: MemoryOrgState = {
      cooldown: null,
      hourKey: hourKeyFor(),
      requestCount: 0,
    };
    this.memory.set(organizationId, created);
    return created;
  }

  private cooldownKey(organizationId: string): string {
    return CacheService.key('bizimhesap', 'cooldown', organizationId);
  }

  private hourlyKey(organizationId: string, hourKey: string): string {
    return CacheService.key('bizimhesap', 'hourly', organizationId, hourKey);
  }

  private nextHourBoundary(): Date {
    const d = new Date();
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(d.getUTCHours() + 1);
    return d;
  }

  private async resolveMaxRequestsPerHour(): Promise<number> {
    try {
      return Math.max(
        1,
        await this.integrationPolicy.getMaxRequestsPerHour(PLATFORM),
      );
    } catch {
      return BIZIMHESAP_MAX_REQUESTS_PER_HOUR;
    }
  }

  private async resolveMinSyncIntervalMs(): Promise<number> {
    try {
      return await this.integrationPolicy.getMinSyncIntervalMsForHourlyCap(PLATFORM);
    } catch {
      return BIZIMHESAP_MIN_SYNC_INTERVAL_MS;
    }
  }

  private async log(
    organizationId: string,
    level: PlatformActivityLevel,
    action: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.activityLog.append({
      platform: PLATFORM,
      organizationId,
      level,
      action,
      message,
      metadata,
    });
    if (level === 'ERROR') {
      this.logger.warn(message, { organizationId, action, ...metadata });
    }
  }

  private async rateLimitMonitorRecord(
    organizationId: string,
    retryAfterSeconds: number,
  ): Promise<void> {
    // RateLimitMonitorService is optional; avoid circular import — log only here.
    this.logger.warn('BizimHesap rate limit ihlali', {
      organizationId,
      retryAfterSeconds,
    });
  }
}
