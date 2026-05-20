import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Queue } from 'bull';
import axios from 'axios';

import { REDIS_CACHE } from '../common/cache/cache.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  QUEUE_ERP_SYNC,
  QUEUE_IMAGE,
  QUEUE_IMAGE_SYNC,
  QUEUE_LISTING_SYNC,
  QUEUE_MARKETPLACE_PULL,
  QUEUE_MARKETPLACE_PUSH,
  QUEUE_NOTIFICATION,
  QUEUE_PRICING,
  QUEUE_WEBHOOK_DELIVERY,
} from '../queue/queue.constants';
import { TRENDYOL_BASE_URL, TRENDYOL_BRANDS } from '../adapters/trendyol/trendyol.constants';
import { HEPSIBURADA_LISTING_BASE_URL } from '../adapters/hepsiburada/hepsiburada.constants';
import type Redis from 'ioredis';

const APP_VERSION = '0.1.0';

export interface ServiceHealthStatus {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}

export interface QueueHealthStatus {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  status: 'up' | 'degraded' | 'down';
}

export interface AdapterHealthStatus {
  platform: string;
  status: 'up' | 'down';
  latencyMs?: number;
}

export interface DetailedHealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  db: ServiceHealthStatus;
  redis: ServiceHealthStatus;
  queues: QueueHealthStatus[];
  adapters: AdapterHealthStatus[];
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(REDIS_CACHE) private readonly redis: Redis | null,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly marketplacePullQueue: Queue,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue,
    @InjectQueue(QUEUE_LISTING_SYNC)
    private readonly listingSyncQueue: Queue,
    @InjectQueue(QUEUE_ERP_SYNC) private readonly erpSyncQueue: Queue,
    @InjectQueue(QUEUE_NOTIFICATION)
    private readonly notificationQueue: Queue,
    @InjectQueue(QUEUE_PRICING) private readonly pricingQueue: Queue,
    @InjectQueue(QUEUE_IMAGE) private readonly imageQueue: Queue,
    @InjectQueue(QUEUE_IMAGE_SYNC) private readonly imageSyncQueue: Queue,
    @InjectQueue(QUEUE_WEBHOOK_DELIVERY)
    private readonly webhookQueue: Queue,
  ) {}

  async checkDb(): Promise<ServiceHealthStatus> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      this.logger.warn('Veritabanı sağlık kontrolü başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { status: 'down', message: 'PostgreSQL yanıt vermiyor' };
    }
  }

  async checkRedis(): Promise<ServiceHealthStatus> {
    if (!this.redis) {
      return { status: 'degraded', message: 'Redis yapılandırılmamış' };
    }
    const start = Date.now();
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect();
      }
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return { status: 'down', message: 'Beklenmeyen PING yanıtı' };
      }
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      this.logger.warn('Redis sağlık kontrolü başarısız', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { status: 'down', message: 'Redis yanıt vermiyor' };
    }
  }

  async checkQueues(): Promise<QueueHealthStatus[]> {
    const queues: { name: string; queue: Queue }[] = [
      { name: QUEUE_MARKETPLACE_PULL, queue: this.marketplacePullQueue },
      { name: QUEUE_MARKETPLACE_PUSH, queue: this.marketplacePushQueue },
      { name: QUEUE_LISTING_SYNC, queue: this.listingSyncQueue },
      { name: QUEUE_ERP_SYNC, queue: this.erpSyncQueue },
      { name: QUEUE_NOTIFICATION, queue: this.notificationQueue },
      { name: QUEUE_PRICING, queue: this.pricingQueue },
      { name: QUEUE_IMAGE, queue: this.imageQueue },
      { name: QUEUE_IMAGE_SYNC, queue: this.imageSyncQueue },
      { name: QUEUE_WEBHOOK_DELIVERY, queue: this.webhookQueue },
    ];

    const results: QueueHealthStatus[] = [];
    for (const { name, queue } of queues) {
      try {
        const counts = await queue.getJobCounts();
        const waiting = counts.waiting ?? 0;
        const active = counts.active ?? 0;
        const delayed = counts.delayed ?? 0;
        const failed = counts.failed ?? 0;
        const backlog = waiting + delayed;
        let status: QueueHealthStatus['status'] = 'up';
        if (failed > 100) {
          status = 'down';
        } else if (backlog > 500 || failed > 20) {
          status = 'degraded';
        }
        results.push({ name, waiting, active, delayed, failed, status });
      } catch (error) {
        this.logger.warn(`Kuyruk sağlık kontrolü başarısız: ${name}`, {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        results.push({
          name,
          waiting: 0,
          active: 0,
          delayed: 0,
          failed: 0,
          status: 'down',
        });
      }
    }
    return results;
  }

  async checkCriticalAdapters(): Promise<AdapterHealthStatus[]> {
    const checks: { platform: string; url: string }[] = [
      {
        platform: 'TRENDYOL',
        url: `${TRENDYOL_BASE_URL}${TRENDYOL_BRANDS}`,
      },
      {
        platform: 'HEPSIBURADA',
        url: HEPSIBURADA_LISTING_BASE_URL,
      },
    ];

    const results: AdapterHealthStatus[] = [];
    for (const { platform, url } of checks) {
      const start = Date.now();
      try {
        const res = await axios.get(url, {
          timeout: 8_000,
          validateStatus: (s) => s < 500,
        });
        results.push({
          platform,
          status: res.status < 500 ? 'up' : 'down',
          latencyMs: Date.now() - start,
        });
      } catch {
        results.push({ platform, status: 'down', latencyMs: Date.now() - start });
      }
    }
    return results;
  }

  async getDetailedHealth(): Promise<DetailedHealthResponse> {
    const [db, redis, queues, adapters] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.checkQueues(),
      this.checkCriticalAdapters(),
    ]);

    const degraded =
      db.status !== 'up' ||
      redis.status === 'down' ||
      queues.some((q) => q.status === 'down') ||
      adapters.some((a) => a.status === 'down');

    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      db,
      redis,
      queues,
      adapters,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version ?? APP_VERSION,
    };
  }
}
