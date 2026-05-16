import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlanTier, SubStatus } from '@prisma/client';
import type { Queue } from 'bull';

import { BuyBoxService } from '../pricing/buybox.service';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_PRICING } from '../queue/queue.constants';
import type { PricingRunRulesJobData } from '../queue/queue.types';

@Injectable()
export class BuyBoxFetchTask {
  private readonly logger = new Logger(BuyBoxFetchTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buyBoxService: BuyBoxService,
    @InjectQueue(QUEUE_PRICING)
    private readonly pricingQueue: Queue<PricingRunRulesJobData>,
  ) {}

  /** Her 15 dakikada PRO/KURUMSAL org'lar için mock BuyBox + fiyat motoru kuyruğu */
  @Cron('0 */15 * * * *')
  async fetchBuyBoxPrices(): Promise<void> {
    const orgs = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.ACTIVE,
        plan: { in: [PlanTier.PRO, PlanTier.KURUMSAL] },
      },
      select: { organizationId: true },
    });

    for (const { organizationId } of orgs) {
      try {
        await this.mockSnapshotsForOrg(organizationId);
        await this.pricingQueue.add(
          'run-rules',
          { organizationId },
          {
            ...STANDARD_QUEUE_JOB_OPTIONS,
            attempts: 2,
            removeOnComplete: { count: 50 },
          },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Bilinmeyen hata';
        this.logger.error('BuyBox zamanlı görev hatası', {
          organizationId,
          error: message,
        });
      }
    }
  }

  private async mockSnapshotsForOrg(organizationId: string): Promise<void> {
    const listings = await this.prisma.listing.findMany({
      where: { organizationId, deletedAt: null },
      take: 200,
      orderBy: { updatedAt: 'desc' },
    });

    for (const listing of listings) {
      const our = Number(listing.salePrice);
      const jitter = (listing.barcode.length % 7) * 0.003;
      const buyBox = Math.round(our * (1.01 + jitter) * 100) / 100;
      const isWinner = our <= buyBox + 0.005;
      await this.buyBoxService.saveSnapshot(
        organizationId,
        listing.barcode,
        listing.platform,
        buyBox,
        our,
        isWinner,
        3 + (listing.barcode.length % 5),
      );
    }
  }
}
