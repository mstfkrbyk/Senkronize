import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubStatus } from '@prisma/client';
import type { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_MARKETPLACE_PULL,
} from '../queue/queue.constants';
import type { MarketplacePullJobData } from '../queue/queue.types';

@Injectable()
export class SyncSchedulerTask {
  private readonly logger = new Logger(SyncSchedulerTask.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_MARKETPLACE_PULL)
    private readonly pullQueue: Queue<MarketplacePullJobData>,
  ) {}

  /** Her 30 dakikada bir sipariş çekme işleri */
  @Cron('*/30 * * * *')
  async scheduleOrderSync(): Promise<void> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { isActive: true, deletedAt: null },
      include: { organization: { include: { subscription: true } } },
    });

    let queued = 0;
    for (const conn of connections) {
      const sub = conn.organization.subscription;
      if (!sub || sub.status === SubStatus.EXPIRED) {
        continue;
      }

      await this.pullQueue.add(
        'pull-orders',
        {
          organizationId: conn.organizationId,
          platform: conn.platform,
          type: 'orders',
          since: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        },
        JOB_DEFAULT_OPTIONS,
      );
      queued += 1;
    }

    if (queued > 0) {
      this.logger.log(`Sipariş sync zamanlandı: ${String(queued)} bağlantı`);
    }
  }

  /** Her gece 02:00'de listeleme çekme işleri */
  @Cron('0 2 * * *')
  async scheduleListingSync(): Promise<void> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { isActive: true, deletedAt: null },
    });

    for (const conn of connections) {
      await this.pullQueue.add(
        'pull-listings',
        {
          organizationId: conn.organizationId,
          platform: conn.platform,
          type: 'stock',
        },
        JOB_DEFAULT_OPTIONS,
      );
    }

    this.logger.log(
      `Gece listing sync zamanlandı: ${String(connections.length)} bağlantı`,
    );
  }
}
