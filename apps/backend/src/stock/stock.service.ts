import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { type StockEntry } from '@prisma/client';
import type { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';

import type { BulkStockUpdateDto } from './stock.dto';

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue<MarketplacePushJobData>,
  ) {}

  async findAll(organizationId: string): Promise<StockEntry[]> {
    return this.prisma.stockEntry.findMany({
      where: { organizationId },
      orderBy: [{ barcode: 'asc' }, { platform: 'asc' }],
    });
  }

  async getLowStock(
    organizationId: string,
    threshold = 10,
  ): Promise<
    Array<
      StockEntry & {
        product: {
          id: string;
          name: string;
          barcode: string;
          sku: string | null;
        } | null;
      }
    >
  > {
    const safeThreshold = Math.max(1, threshold);
    return this.prisma.stockEntry.findMany({
      where: { organizationId, quantity: { lt: safeThreshold } },
      include: { product: true },
      orderBy: { quantity: 'asc' },
    });
  }

  async bulkUpdate(
    organizationId: string,
    dto: BulkStockUpdateDto,
  ): Promise<{ jobIds: string[] }> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
    });
    const jobIds: string[] = [];
    const updatesPayload = dto.updates.map((u) => ({
      barcode: u.barcode,
      quantity: u.quantity,
    }));
    for (const conn of connections) {
      const job = await this.marketplacePushQueue.add(
        'push-stock',
        {
          organizationId,
          platform: conn.platform,
          type: 'stock',
          resourceIds: dto.updates.map((u) => u.barcode),
          payload: { updates: updatesPayload },
        },
        STANDARD_QUEUE_JOB_OPTIONS,
      );
      jobIds.push(String(job.id));
    }
    return { jobIds };
  }
}
