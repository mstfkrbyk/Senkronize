import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubStatus } from '@prisma/client';
import type { Queue } from 'bull';

import { IntegrationPolicyService } from '../integration-policy/integration-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_MARKETPLACE_PULL,
} from '../queue/queue.constants';
import type { MarketplacePullJobData } from '../queue/queue.types';

@Injectable()
export class SyncSchedulerTask {
  private readonly logger = new Logger(SyncSchedulerTask.name);
  private lastOrderSyncByPlatform = new Map<string, number>();
  private lastListingSyncByPlatform = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationPolicy: IntegrationPolicyService,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly pullQueue: Queue<MarketplacePullJobData>,
  ) {}

  @Cron('* * * * *')
  async tickOrderSync(): Promise<void> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { isActive: true, deletedAt: null },
      include: { organization: { include: { subscription: true } } },
    });

    const byPlatform = new Map<string, typeof connections>();
    for (const conn of connections) {
      const sub = conn.organization.subscription;
      if (!sub || sub.status === SubStatus.EXPIRED) {
        continue;
      }
      const platform = conn.platform;
      const list = byPlatform.get(platform) ?? [];
      list.push(conn);
      byPlatform.set(platform, list);
    }

    let queued = 0;
    const now = Date.now();
    for (const [platform, conns] of byPlatform.entries()) {
      const enabled = await this.integrationPolicy.isIntegrationEnabled(platform);
      if (!enabled) {
        continue;
      }
      const intervalMs =
        await this.integrationPolicy.getOrderSyncIntervalMs(platform);
      const last = this.lastOrderSyncByPlatform.get(platform) ?? 0;
      if (now - last < intervalMs) {
        continue;
      }
      this.lastOrderSyncByPlatform.set(platform, now);
      const lookbackMs = await this.integrationPolicy.getOrderLookbackMs(platform);
      for (const conn of conns) {
        await this.pullQueue.add(
          'pull-orders',
          {
            organizationId: conn.organizationId,
            platform: conn.platform,
            type: 'orders',
            since: new Date(now - lookbackMs).toISOString(),
          },
          JOB_DEFAULT_OPTIONS,
        );
        queued += 1;
      }
    }

    if (queued > 0) {
      this.logger.log(`Sipariş sync zamanlandı: ${String(queued)} bağlantı`);
    }
  }

  /** Platform ilan listesi — e-ticaret varsayılan 5 dk, pazaryeri 60 dk (admin customSettings ile özelleştirilebilir) */
  @Cron('* * * * *')
  async tickListingSync(): Promise<void> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { isActive: true, deletedAt: null },
      include: { organization: { include: { subscription: true } } },
    });

    const byPlatform = new Map<string, typeof connections>();
    for (const conn of connections) {
      const sub = conn.organization.subscription;
      if (!sub || sub.status === SubStatus.EXPIRED) {
        continue;
      }
      const list = byPlatform.get(conn.platform) ?? [];
      list.push(conn);
      byPlatform.set(conn.platform, list);
    }

    let queued = 0;
    const now = Date.now();
    for (const [platform, conns] of byPlatform.entries()) {
      const enabled = await this.integrationPolicy.isIntegrationEnabled(platform);
      if (!enabled) {
        continue;
      }
      const intervalMs =
        await this.integrationPolicy.getListingSyncIntervalMs(platform);
      const last = this.lastListingSyncByPlatform.get(platform) ?? 0;
      if (now - last < intervalMs) {
        continue;
      }
      this.lastListingSyncByPlatform.set(platform, now);
      for (const conn of conns) {
        await this.pullQueue.add(
          'pull-listings',
          {
            organizationId: conn.organizationId,
            platform: conn.platform,
            type: 'listings',
          },
          JOB_DEFAULT_OPTIONS,
        );
        queued += 1;
      }
    }

    if (queued > 0) {
      this.logger.log(`İlan sync zamanlandı: ${String(queued)} bağlantı`);
    }
  }
}
