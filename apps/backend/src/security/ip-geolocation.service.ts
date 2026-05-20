import { Injectable, Logger } from '@nestjs/common';

import { CacheService } from '../common/cache/cache.service';

interface IpApiResponse {
  status?: string;
  country?: string;
  regionName?: string;
  city?: string;
}

@Injectable()
export class IpGeolocationService {
  private readonly logger = new Logger(IpGeolocationService.name);

  constructor(private readonly cache: CacheService) {}

  async resolveLocation(ip: string | undefined): Promise<string | null> {
    if (!ip?.trim()) {
      return null;
    }
    const normalized = ip.trim();
    if (
      normalized === '127.0.0.1' ||
      normalized === '::1' ||
      normalized.startsWith('192.168.') ||
      normalized.startsWith('10.') ||
      normalized.startsWith('172.')
    ) {
      return 'Yerel ağ';
    }

    const cacheKey = CacheService.key('geo', 'ip', normalized);
    const cached = await this.cache.get<{ location: string }>(cacheKey);
    if (cached?.location) {
      return cached.location;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=status,country,regionName,city`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as IpApiResponse;
      if (data.status !== 'success') {
        return null;
      }
      const parts = [data.city, data.regionName, data.country].filter(
        (p): p is string => typeof p === 'string' && p.length > 0,
      );
      const location = parts.length > 0 ? parts.join(', ') : null;
      if (location) {
        await this.cache.set(cacheKey, { location }, 86_400);
      }
      return location;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`IP konum çözümlemesi başarısız: ${message}`);
      return null;
    }
  }
}
