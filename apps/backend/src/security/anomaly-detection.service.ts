import { Injectable, Logger } from '@nestjs/common';
import {
  AnomalySeverity,
  AnomalyType,
  UserRole,
} from '@prisma/client';

import { CacheService } from '../common/cache/cache.service';
import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import { IpBlockService } from './ip-block.service';

const FAILED_LOGIN_IP_THRESHOLD = 10;
const FAILED_LOGIN_IP_WINDOW_SEC = 300;
const MULTI_COUNTRY_WINDOW_SEC = 900;
const MULTI_COUNTRY_THRESHOLD = 3;
const API_KEY_RATE_THRESHOLD = 1000;
const NIGHT_ACTIVITY_THRESHOLD = 100;

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly ipBlock: IpBlockService,
  ) {}

  /** JWT oturumlu HTTP istekleri — dakikalık hacim izleme */
  async recordHttpRequest(organizationId: string): Promise<void> {
    const bucket = Math.floor(Date.now() / 60_000);
    const key = CacheService.key('security', 'api_minute', organizationId, String(bucket));
    const n = await this.cache.incrWithExpire(key, 120);
    if (n === null) {
      return;
    }

    const istanbulHour = this.getIstanbulHour(new Date());
    if (istanbulHour >= 3 && istanbulHour < 5 && n >= NIGHT_ACTIVITY_THRESHOLD) {
      await this.logAnomaly({
        organizationId,
        type: AnomalyType.NIGHT_ACTIVITY,
        severity: AnomalySeverity.MEDIUM,
        details: { requestCount: n, hour: istanbulHour },
      });
    }

    if (n > 100) {
      await this.checkApiAnomalies(organizationId, n);
    }
  }

  /** API anahtarı ile yapılan istekler — dakikada 1000+ eşik */
  async recordApiKeyRequest(
    organizationId: string,
    apiKeyId: string,
  ): Promise<void> {
    const bucket = Math.floor(Date.now() / 60_000);
    const key = CacheService.key(
      'security',
      'api_key_minute',
      organizationId,
      apiKeyId,
      String(bucket),
    );
    const n = await this.cache.incrWithExpire(key, 120);
    if (n === null || n < API_KEY_RATE_THRESHOLD) {
      return;
    }

    const rateLimitKey = CacheService.key(
      'security',
      'api_key_rate_limited',
      apiKeyId,
    );
    const already = await this.cache.get<{ v: true }>(rateLimitKey);
    if (already) {
      return;
    }
    await this.cache.set(rateLimitKey, { v: true }, 3600);

    await this.logAnomaly({
      organizationId,
      type: AnomalyType.API_RATE_SPIKE,
      severity: AnomalySeverity.HIGH,
      details: { apiKeyId, requestCount: n, windowMinutes: 1 },
    });

    this.logger.warn('API anahtarı hız limiti aşıldı', {
      organizationId,
      apiKeyId,
      requestCount: n,
    });
  }

  async isApiKeyRateLimited(apiKeyId: string): Promise<boolean> {
    const rateLimitKey = CacheService.key(
      'security',
      'api_key_rate_limited',
      apiKeyId,
    );
    const hit = await this.cache.get<{ v: true }>(rateLimitKey);
    return hit != null;
  }

  async checkApiAnomalies(
    organizationId: string,
    requestCount?: number,
  ): Promise<void> {
    const warnKey = CacheService.key('security', 'api_anomaly_warn', organizationId);
    const already = await this.cache.get<{ v: true }>(warnKey);
    if (already) {
      return;
    }
    await this.cache.set(warnKey, { v: true }, 3600);

    await this.logAnomaly({
      organizationId,
      type: AnomalyType.API_RATE_SPIKE,
      severity: AnomalySeverity.MEDIUM,
      details: { requestCount: requestCount ?? null, source: 'jwt_session' },
    });

    this.logger.warn('Olağandışı API kullanımı tespit edildi', { organizationId });
    const owners = await this.prisma.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
        role: { in: [UserRole.OWNER, UserRole.ADMIN] },
      },
      select: { email: true },
      take: 5,
    });
    for (const row of owners) {
      await this.emailService.sendApiAnomalyAlert(row.email, organizationId);
    }
  }

  /** Aynı IP'den kısa sürede çok sayıda başarısız giriş */
  async recordFailedLogin(ip: string | undefined): Promise<void> {
    if (!ip?.trim()) {
      return;
    }
    const normalized = this.ipBlock.normalizeClientIp(ip, undefined);
    if (!normalized) {
      return;
    }

    const key = CacheService.key(
      'security',
      'failed_login_ip',
      normalized,
    );
    const n = await this.cache.incrWithExpire(key, FAILED_LOGIN_IP_WINDOW_SEC);
    if (n === null || n <= FAILED_LOGIN_IP_THRESHOLD) {
      return;
    }

    const blockKey = CacheService.key('security', 'failed_ip_blocked', normalized);
    const already = await this.cache.get<{ v: true }>(blockKey);
    if (already) {
      return;
    }
    await this.cache.set(blockKey, { v: true }, FAILED_LOGIN_IP_WINDOW_SEC);

    await this.ipBlock.setBlocked(normalized, true);
    setTimeout(() => {
      void this.ipBlock.setBlocked(normalized, false);
    }, FAILED_LOGIN_IP_WINDOW_SEC * 1000);

    await this.logAnomaly({
      organizationId: null,
      type: AnomalyType.FAILED_LOGIN_BURST,
      severity: AnomalySeverity.HIGH,
      details: { ip: normalized, attemptCount: n, windowSeconds: FAILED_LOGIN_IP_WINDOW_SEC },
    });

    this.logger.warn('IP geçici olarak engellendi (başarısız giriş)', {
      ip: normalized,
      attemptCount: n,
    });

    const admins = await this.prisma.user.findMany({
      where: { deletedAt: null, role: UserRole.SUPER_ADMIN },
      select: { email: true },
      take: 5,
    });
    for (const admin of admins) {
      await this.emailService.sendApiAnomalyAlert(
        admin.email,
        `failed-login-ip:${normalized}`,
      );
    }
  }

  /** Kısa sürede farklı ülkelerden giriş */
  async recordLoginCountry(
    userId: string,
    organizationId: string,
    country: string | null,
  ): Promise<void> {
    if (!country?.trim()) {
      return;
    }
    const normalized = country.trim();
    const key = CacheService.key('security', 'login_countries', userId);
    const existing = (await this.cache.get<string[]>(key)) ?? [];
    if (!existing.includes(normalized)) {
      existing.push(normalized);
    }
    await this.cache.set(key, existing, MULTI_COUNTRY_WINDOW_SEC);

    const uniqueCountries = new Set(existing);
    if (uniqueCountries.size < MULTI_COUNTRY_THRESHOLD) {
      return;
    }

    const flagKey = CacheService.key('security', 'multi_country_flag', userId);
    const already = await this.cache.get<{ v: true }>(flagKey);
    if (already) {
      return;
    }
    await this.cache.set(flagKey, { v: true }, MULTI_COUNTRY_WINDOW_SEC);

    const lockedUntil = new Date();
    lockedUntil.setHours(lockedUntil.getHours() + 1);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil },
    });

    await this.logAnomaly({
      organizationId,
      userId,
      type: AnomalyType.MULTI_COUNTRY_LOGIN,
      severity: AnomalySeverity.CRITICAL,
      details: {
        countries: [...uniqueCountries],
        windowSeconds: MULTI_COUNTRY_WINDOW_SEC,
      },
    });

    await this.emailService.sendSuspiciousLoginAlert(
      user.email,
      `${MULTI_COUNTRY_THRESHOLD} farklı ülkeden kısa sürede giriş tespit edildi. Hesabınız güvenlik nedeniyle geçici olarak kilitlendi.`,
    );
  }

  async checkNewIpLogin(userId: string, ip: string | undefined): Promise<void> {
    if (!ip) {
      return;
    }
    const key = CacheService.key('security', 'known_login_ip', userId);
    const known = await this.cache.sismember(key, ip);
    if (known === null) {
      this.logger.debug('Redis yok; bilinen IP listesi kullanılamıyor');
      return;
    }
    if (known === true) {
      return;
    }
    await this.cache.sadd(key, ip);
  }

  async getKnownIps(userId: string): Promise<string[]> {
    const key = CacheService.key('security', 'known_login_ip', userId);
    const list = await this.cache.smembers(key);
    return list ?? [];
  }

  async saveKnownIp(userId: string, ip: string): Promise<void> {
    const key = CacheService.key('security', 'known_login_ip', userId);
    await this.cache.sadd(key, ip);
  }

  /**
   * Gece (03–05, Europe/Istanbul) yüksek hacimli toplu işlemlerde anomali kaydı.
   */
  async checkBulkOperation(
    organizationId: string,
    operation: string,
    count: number,
  ): Promise<void> {
    if (count < 50) {
      return;
    }
    const istanbulHour = this.getIstanbulHour(new Date());
    if (istanbulHour < 3 || istanbulHour >= 5) {
      return;
    }

    await this.logAnomaly({
      organizationId,
      type: AnomalyType.NIGHT_ACTIVITY,
      severity: AnomalySeverity.MEDIUM,
      details: { operation, count, hour: istanbulHour },
    });
  }

  private async logAnomaly(params: {
    organizationId: string | null;
    userId?: string;
    type: AnomalyType;
    severity: AnomalySeverity;
    details: Record<string, unknown>;
  }): Promise<void> {
    let orgId = params.organizationId;
    if (!orgId) {
      const fallback = await this.prisma.organization.findFirst({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      orgId = fallback?.id ?? null;
    }
    if (!orgId) {
      this.logger.warn('Anomali kaydı yazılamadı: organizasyon bulunamadı', {
        type: params.type,
      });
      return;
    }

    try {
      await this.prisma.anomalyLog.create({
        data: {
          organizationId: orgId,
          userId: params.userId ?? null,
          type: params.type,
          severity: params.severity,
          details: params.details as object,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Anomali kaydı yazılamadı: ${message}`);
    }
  }

  private getIstanbulHour(d: Date): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(d);
    const h = parts.find((p) => p.type === 'hour')?.value;
    const n = h ? parseInt(h, 10) : NaN;
    return Number.isNaN(n) ? d.getUTCHours() : n;
  }
}
