import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

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
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip =
      (typeof req.ip === 'string' && req.ip) ||
      (typeof (req as { socket?: { remoteAddress?: string } }).socket
        ?.remoteAddress === 'string' &&
        (req as { socket: { remoteAddress: string } }).socket.remoteAddress) ||
      'unknown';
    return ip;
  }

  protected getThrottlers(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      originalUrl?: string;
      url?: string;
      path?: string;
    }>();
    const path =
      request.originalUrl ?? request.url ?? request.path ?? '';
    const { ttl, limit } = matchRouteLimit(path);
    return [
      {
        name: 'route',
        ttl: ttl * 1000,
        limit,
      },
    ];
  }
}
