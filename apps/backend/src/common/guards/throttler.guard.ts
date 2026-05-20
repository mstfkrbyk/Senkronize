import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { PlanTier, SubStatus } from '@prisma/client';

import type { AuthenticatedUser } from '../../auth/auth.types';
import { RateLimitMonitorService } from '../../monitoring/rate-limit-monitor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_LIMITS } from '../../subscription/plan-limits';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';

const DAY_MS = 86_400_000;

/** Saniye cinsinden TTL — Nest Throttler milisaniye bekler. */
export const rateLimitConfig = {
  '/auth/login': { ttl: 60, limit: 5 },
  '/auth/register': { ttl: 3600, limit: 3 },
  '/sync': { ttl: 60, limit: 10 },
  default: { ttl: 60, limit: 100 },
} as const;

function matchRouteLimit(path: string): { ttl: number; limit: number } {
  const normalized = path.split('?')[0] ?? path;
  if (normalized.includes('/auth/login')) {
    return rateLimitConfig['/auth/login'];
  }
  if (normalized.includes('/auth/register')) {
    return rateLimitConfig['/auth/register'];
  }
  if (normalized.includes('/sync')) {
    return rateLimitConfig['/sync'];
  }
  return rateLimitConfig.default;
}

@Injectable()
export class SenkronizeThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly rateLimitMonitor: RateLimitMonitorService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as AuthenticatedUser | undefined;
    if (user?.currentOrgId) {
      return `org:${user.currentOrgId}`;
    }
    const ip =
      (typeof req.ip === 'string' && req.ip) ||
      (typeof (req as { socket?: { remoteAddress?: string } }).socket
        ?.remoteAddress === 'string' &&
        (req as { socket: { remoteAddress: string } }).socket.remoteAddress) ||
      'unknown';
    return `ip:${ip}`;
  }

  protected getThrottlers(context: ExecutionContext): ThrottlerOptions[] {
    const request = context.switchToHttp().getRequest<{
      originalUrl?: string;
      url?: string;
      path?: string;
      user?: AuthenticatedUser;
    }>();
    const path =
      request.originalUrl ?? request.url ?? request.path ?? '';
    const { ttl, limit } = matchRouteLimit(path);
    const orgId = request.user?.currentOrgId;

    const throttlers: ThrottlerOptions[] = [
      {
        name: 'route',
        ttl: ttl * 1000,
        limit,
      },
    ];

    if (orgId) {
      throttlers.push({
        name: 'daily',
        ttl: DAY_MS,
        limit: () => this.resolveDailyApiLimit(orgId),
      });
    }

    return throttlers;
  }

  protected async handleRequest(
    requestProps: Parameters<ThrottlerGuard['handleRequest']>[0],
  ): Promise<boolean> {
    const result = await super.handleRequest(requestProps);
    const { context, throttler } = requestProps;
    const { res } = this.getRequestResponse(context);
    const ttlMs =
      typeof requestProps.ttl === 'number' ? requestProps.ttl : DAY_MS;
    const resetUnix = Math.ceil(Date.now() / 1000) + Math.ceil(ttlMs / 1000);
    const suffix = throttler.name === 'default' ? '' : `-${throttler.name}`;
    res.header(`X-RateLimit-Reset${suffix}`, resetUnix);

    if (throttler.name === 'daily') {
      const limit =
        typeof requestProps.limit === 'number'
          ? requestProps.limit
          : await this.resolveDailyApiLimit(
              (
                context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
                  .user
              )?.currentOrgId ?? '',
            );
      const remaining = res.getHeader('X-RateLimit-Remaining-daily');
      res.header('X-RateLimit-Limit', limit);
      if (remaining !== undefined) {
        res.header('X-RateLimit-Remaining', remaining);
        res.header('X-RateLimit-Reset', resetUnix);
      }
    }
    return result;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: Parameters<ThrottlerGuard['throwThrottlingException']>[1],
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const orgId = request.user?.currentOrgId;
    if (orgId && detail.ttl >= DAY_MS) {
      const plan = await this.resolveOrgPlan(orgId);
      void this.rateLimitMonitor.recordApiDailyLimitViolation(
        orgId,
        plan,
        PLAN_LIMITS[plan].apiCallsPerDay,
      );
    }
    await super.throwThrottlingException(context, detail);
  }

  private async resolveDailyApiLimit(orgId: string): Promise<number> {
    const plan = await this.resolveOrgPlan(orgId);
    const limit = PLAN_LIMITS[plan].apiCallsPerDay;
    if (limit < 0) {
      return 1_000_000_000;
    }
    return limit;
  }

  private async resolveOrgPlan(orgId: string): Promise<PlanTier> {
    const cacheKey = CacheKeys.subscription(orgId);
    const cached = await this.cache.get<{ plan: PlanTier }>(cacheKey);
    if (cached?.plan) {
      return cached.plan;
    }

    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: { plan: true, status: true },
    });
    if (!sub) {
      throw new UnauthorizedException();
    }
    const plan =
      sub.status === SubStatus.TRIAL ? PlanTier.BASLANGIC : sub.plan;
    await this.cache.set(cacheKey, { plan }, 300);
    return plan;
  }
}
