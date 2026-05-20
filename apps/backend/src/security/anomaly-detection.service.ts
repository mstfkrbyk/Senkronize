import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CacheService } from '../common/cache/cache.service';
import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  /** Dakikalık istek sayısını artırır; eşik aşılırsa uyar. */
  async recordHttpRequest(organizationId: string): Promise<void> {
    const bucket = Math.floor(Date.now() / 60_000);
    const key = CacheService.key('security', 'api_minute', organizationId, String(bucket));
    const n = await this.cache.incrWithExpire(key, 120);
    if (n === null) {
      return;
    }
    if (n > 100) {
      await this.checkApiAnomalies(organizationId);
    }
  }

  async checkApiAnomalies(organizationId: string): Promise<void> {
    const warnKey = CacheService.key('security', 'api_anomaly_warn', organizationId);
    const already = await this.cache.get<{ v: true }>(warnKey);
    if (already) {
      return;
    }
    await this.cache.set(warnKey, { v: true }, 3600);
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
   * Gece (00–05, Europe/Istanbul) yüksek hacimli toplu işlemlerde denetim kaydı üretir.
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
    if (istanbulHour < 0 || istanbulHour > 5) {
      return;
    }
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: 'security:anomaly',
          actorOrgId: organizationId,
          impersonatedOrgId: null,
          action: 'security.suspect_bulk_night',
          resourceType: 'Organization',
          resourceId: organizationId,
          metadata: { operation, count },
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Toplu işlem anomali kaydı yazılamadı: ${message}`);
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
