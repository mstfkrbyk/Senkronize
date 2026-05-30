import { Injectable, NotFoundException } from '@nestjs/common';
import type { IntegrationPlatformPolicy, SyncFrequency } from '@prisma/client';

import { getPlatformRateLimit } from '../adapters/common/rate-limit.config';
import type { PlatformCircuitHealth } from '../adapters/common/platform-health.service';
import { PlatformHealthService } from '../adapters/common/platform-health.service';
import { RateLimitMonitorService } from '../monitoring/rate-limit-monitor.service';
import { PrismaService } from '../prisma/prisma.service';

import type { UpdateIntegrationPolicyDto } from './integration-policy.dto';
import {
  GLOBAL_POLICY_DEFAULTS,
  INTEGRATION_REGISTRY,
  categoryLabel,
  resolveRegistryEntry,
} from './integration-policy.schemas';
import type {
  AdminIntegrationDetail,
  AdminIntegrationListItem,
  IntegrationCircuitHealthView,
  IntegrationPolicyValues,
} from './integration-policy.types';

const CACHE_TTL_MS = 30_000;

@Injectable()
export class IntegrationPolicyService {
  private policyCache = new Map<string, IntegrationPlatformPolicy | null>();
  private cacheAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformHealth: PlatformHealthService,
    private readonly rateLimitMonitor: RateLimitMonitorService,
  ) {}

  async listForAdmin(): Promise<AdminIntegrationListItem[]> {
    const [healthRows, stats, policies] = await Promise.all([
      this.platformHealth.getAllPlatformHealth(),
      this.rateLimitMonitor.getStats(),
      this.loadAllPolicies(),
    ]);
    const policyMap = new Map(policies.map((p) => [p.platformKey, p]));
    const requestsByPlatform = new Map<string, number>();
    for (const row of stats.platformDailyRequests) {
      requestsByPlatform.set(
        row.platform.toUpperCase(),
        (requestsByPlatform.get(row.platform.toUpperCase()) ?? 0) +
          row.requestCount,
      );
    }

    const platformKeys = new Set<string>();
    for (const entry of INTEGRATION_REGISTRY) {
      platformKeys.add(entry.platformKey);
    }
    for (const row of healthRows) {
      platformKeys.add(row.platform.toUpperCase());
    }

    const items: AdminIntegrationListItem[] = [];
    for (const platformKey of [...platformKeys].sort()) {
      const registry = resolveRegistryEntry(platformKey);
      const policy = policyMap.get(platformKey) ?? null;
      const health = this.toHealthView(
        healthRows.find((h) => h.platform === platformKey) ?? {
          platform: platformKey,
          state: 'CLOSED',
          consecutiveFailures: 0,
          halfOpenSuccesses: 0,
          errorCountInWindow: 0,
          openedAt: null,
          nextProbeAt: null,
        },
      );
      const effective = this.resolveEffective(platformKey, policy);
      items.push({
        platformKey,
        displayName: registry.displayName,
        category: registry.category,
        categoryLabel: categoryLabel(registry.category),
        enabled: effective.enabled,
        health,
        effectiveRpm:
          effective.requestsPerMinute ??
          getPlatformRateLimit(platformKey).rpm,
        requestsToday: requestsByPlatform.get(platformKey) ?? 0,
        hasCustomPolicy: policy !== null,
        updatedAt: policy?.updatedAt.toISOString() ?? null,
      });
    }
    return items;
  }

  async getDetail(platformKey: string): Promise<AdminIntegrationDetail> {
    const key = platformKey.toUpperCase();
    const registry = resolveRegistryEntry(key);
    const policy = await this.getPolicyRow(key);
    const [health, stats] = await Promise.all([
      this.platformHealth.getPlatformHealth(key),
      this.rateLimitMonitor.getStats(),
    ]);
    const values = this.rowToValues(policy);
    const effective = this.resolveEffective(key, policy);
    const violationsToday =
      stats.topViolatingPlatforms.find((v) => v.platform === key)?.count ?? 0;
    const requestsToday = stats.platformDailyRequests
      .filter((r) => r.platform.toUpperCase() === key)
      .reduce((sum, r) => sum + r.requestCount, 0);

    return {
      platformKey: key,
      displayName: registry.displayName,
      category: registry.category,
      categoryLabel: categoryLabel(registry.category),
      schema: registry,
      fields: registry.fields,
      values,
      effective,
      health: this.toHealthView(health),
      requestsToday,
      violationsToday,
      updatedAt: policy?.updatedAt.toISOString() ?? null,
      updatedByUserId: policy?.updatedByUserId ?? null,
    };
  }

  async updatePolicy(
    platformKey: string,
    dto: UpdateIntegrationPolicyDto,
    updatedByUserId: string,
  ): Promise<AdminIntegrationDetail> {
    const key = platformKey.toUpperCase();
    const registry = resolveRegistryEntry(key);

    await this.prisma.integrationPlatformPolicy.upsert({
      where: { platformKey: key },
      create: {
        platformKey: key,
        category: registry.category,
        enabled: dto.enabled ?? true,
        orderSyncIntervalMinutes: dto.orderSyncIntervalMinutes ?? null,
        orderLookbackMinutes: dto.orderLookbackMinutes ?? null,
        listingSyncIntervalMinutes: dto.listingSyncIntervalMinutes ?? null,
        listingSyncHour: dto.listingSyncHour ?? null,
        maxRequestsPerHour: dto.maxRequestsPerHour ?? null,
        requestsPerMinute: dto.requestsPerMinute ?? null,
        syncFrequency: dto.syncFrequency ?? null,
        updatedByUserId,
      },
      update: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.orderSyncIntervalMinutes !== undefined
          ? { orderSyncIntervalMinutes: dto.orderSyncIntervalMinutes }
          : {}),
        ...(dto.orderLookbackMinutes !== undefined
          ? { orderLookbackMinutes: dto.orderLookbackMinutes }
          : {}),
        ...(dto.listingSyncIntervalMinutes !== undefined
          ? { listingSyncIntervalMinutes: dto.listingSyncIntervalMinutes }
          : {}),
        ...(dto.listingSyncHour !== undefined
          ? { listingSyncHour: dto.listingSyncHour }
          : {}),
        ...(dto.maxRequestsPerHour !== undefined
          ? { maxRequestsPerHour: dto.maxRequestsPerHour }
          : {}),
        ...(dto.requestsPerMinute !== undefined
          ? { requestsPerMinute: dto.requestsPerMinute }
          : {}),
        ...(dto.syncFrequency !== undefined
          ? { syncFrequency: dto.syncFrequency }
          : {}),
        updatedByUserId,
      },
    });
    this.invalidateCache();
    return this.getDetail(key);
  }

  async resetCircuit(platformKey: string): Promise<void> {
    await this.platformHealth.resetCircuit(platformKey.toUpperCase());
  }

  async getOrderSyncIntervalMs(platformKey: string): Promise<number> {
    const effective = await this.getEffectiveForPlatform(platformKey);
    if (!effective.enabled) {
      return Number.MAX_SAFE_INTEGER;
    }
    const minutes =
      effective.orderSyncIntervalMinutes ??
      GLOBAL_POLICY_DEFAULTS.orderSyncIntervalMinutes;
    return minutes * 60_000;
  }

  async getOrderLookbackMs(platformKey: string): Promise<number> {
    const effective = await this.getEffectiveForPlatform(platformKey);
    const minutes =
      effective.orderLookbackMinutes ?? GLOBAL_POLICY_DEFAULTS.orderLookbackMinutes;
    return minutes * 60_000;
  }

  /** Platform ilan listesi çekme aralığı (ms) */
  async getListingSyncIntervalMs(platformKey: string): Promise<number> {
    const effective = await this.getEffectiveForPlatform(platformKey);
    if (!effective.enabled) {
      return Number.MAX_SAFE_INTEGER;
    }
    const registry = resolveRegistryEntry(platformKey.toUpperCase());
    const minutes =
      effective.listingSyncIntervalMinutes ??
      (registry.category === 'ECOMMERCE' ? 5 : GLOBAL_POLICY_DEFAULTS.listingSyncIntervalMinutes);
    return minutes * 60_000;
  }

  async isIntegrationEnabled(platformKey: string): Promise<boolean> {
    const effective = await this.getEffectiveForPlatform(platformKey);
    return effective.enabled;
  }

  async getMaxRequestsPerHour(platformKey: string): Promise<number> {
    const effective = await this.getEffectiveForPlatform(platformKey);
    return effective.maxRequestsPerHour ?? GLOBAL_POLICY_DEFAULTS.maxRequestsPerHour;
  }

  async getMinSyncIntervalMsForHourlyCap(platformKey: string): Promise<number> {
    const maxPerHour = Math.max(1, await this.getMaxRequestsPerHour(platformKey));
    return (60 * 60 * 1000) / maxPerHour;
  }

  async getDefaultErpSyncFrequency(platformKey: string): Promise<SyncFrequency> {
    const effective = await this.getEffectiveForPlatform(platformKey);
    return effective.syncFrequency ?? GLOBAL_POLICY_DEFAULTS.syncFrequency;
  }

  async getBizimhesapMinSyncIntervalMs(): Promise<number> {
    return this.getMinSyncIntervalMsForHourlyCap('BIZIMHESAP');
  }

  invalidateCache(): void {
    this.policyCache.clear();
    this.cacheAt = 0;
  }

  private async getEffectiveForPlatform(
    platformKey: string,
  ): Promise<IntegrationPolicyValues> {
    const policy = await this.getPolicyRow(platformKey.toUpperCase());
    return this.resolveEffective(platformKey.toUpperCase(), policy);
  }

  private resolveEffective(
    platformKey: string,
    policy: IntegrationPlatformPolicy | null,
  ): IntegrationPolicyValues {
    const defaults = this.platformDefaults(platformKey);
    return {
      enabled: policy?.enabled ?? true,
      orderSyncIntervalMinutes:
        policy?.orderSyncIntervalMinutes ??
        defaults.orderSyncIntervalMinutes ??
        GLOBAL_POLICY_DEFAULTS.orderSyncIntervalMinutes,
      orderLookbackMinutes:
        policy?.orderLookbackMinutes ??
        defaults.orderLookbackMinutes ??
        GLOBAL_POLICY_DEFAULTS.orderLookbackMinutes,
      listingSyncIntervalMinutes:
        policy?.listingSyncIntervalMinutes ??
        defaults.listingSyncIntervalMinutes ??
        (resolveRegistryEntry(platformKey).category === 'ECOMMERCE'
          ? 5
          : GLOBAL_POLICY_DEFAULTS.listingSyncIntervalMinutes),
      listingSyncHour:
        policy?.listingSyncHour ??
        defaults.listingSyncHour ??
        null,
      maxRequestsPerHour:
        policy?.maxRequestsPerHour ??
        defaults.maxRequestsPerHour ??
        (platformKey === 'BIZIMHESAP'
          ? GLOBAL_POLICY_DEFAULTS.maxRequestsPerHour
          : null),
      requestsPerMinute:
        policy?.requestsPerMinute ?? defaults.requestsPerMinute ?? null,
      syncFrequency:
        policy?.syncFrequency ??
        defaults.syncFrequency ??
        (resolveRegistryEntry(platformKey).category === 'ERP'
          ? GLOBAL_POLICY_DEFAULTS.syncFrequency
          : null),
    };
  }

  private platformDefaults(
    platformKey: string,
  ): Partial<IntegrationPolicyValues> {
    if (platformKey.toUpperCase() === 'BIZIMHESAP') {
      return {
        maxRequestsPerHour: 10,
        syncFrequency: 'HOURLY' as SyncFrequency,
      };
    }
    return {};
  }

  private rowToValues(
    policy: IntegrationPlatformPolicy | null,
  ): IntegrationPolicyValues {
    if (!policy) {
      return {
        enabled: true,
        orderSyncIntervalMinutes: null,
        orderLookbackMinutes: null,
        listingSyncIntervalMinutes: null,
        listingSyncHour: null,
        maxRequestsPerHour: null,
        requestsPerMinute: null,
        syncFrequency: null,
      };
    }
    return {
      enabled: policy.enabled,
      orderSyncIntervalMinutes: policy.orderSyncIntervalMinutes,
      orderLookbackMinutes: policy.orderLookbackMinutes,
      listingSyncIntervalMinutes: policy.listingSyncIntervalMinutes,
      listingSyncHour: policy.listingSyncHour,
      maxRequestsPerHour: policy.maxRequestsPerHour,
      requestsPerMinute: policy.requestsPerMinute,
      syncFrequency: policy.syncFrequency,
    };
  }

  private async getPolicyRow(
    platformKey: string,
  ): Promise<IntegrationPlatformPolicy | null> {
    if (Date.now() - this.cacheAt < CACHE_TTL_MS && this.policyCache.has(platformKey)) {
      return this.policyCache.get(platformKey) ?? null;
    }
    const row = await this.prisma.integrationPlatformPolicy.findUnique({
      where: { platformKey },
    });
    this.policyCache.set(platformKey, row);
    this.cacheAt = Date.now();
    return row;
  }

  private async loadAllPolicies(): Promise<IntegrationPlatformPolicy[]> {
    if (Date.now() - this.cacheAt < CACHE_TTL_MS && this.policyCache.size > 0) {
      return [...this.policyCache.values()].filter(
        (row): row is IntegrationPlatformPolicy => row != null,
      );
    }
    const rows = await this.prisma.integrationPlatformPolicy.findMany();
    for (const row of rows) {
      this.policyCache.set(row.platformKey, row);
    }
    this.cacheAt = Date.now();
    return rows;
  }

  private toHealthView(health: PlatformCircuitHealth): IntegrationCircuitHealthView {
    const score =
      health.state === 'CLOSED' ? 100 : health.state === 'HALF_OPEN' ? 50 : 0;
    return { ...health, healthScore: score };
  }

  assertPlatformKey(platformKey: string): string {
    const key = platformKey.trim().toUpperCase();
    if (!key) {
      throw new NotFoundException('Entegrasyon bulunamadı');
    }
    return key;
  }
}
