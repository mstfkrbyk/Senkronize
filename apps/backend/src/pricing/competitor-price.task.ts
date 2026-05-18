import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlanTier, SubStatus } from '@prisma/client';
import type { Queue } from 'bull';

import { BuyBoxService } from './buybox.service';
import { CompetitorPriceService } from './competitor-price.service';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_PRICING } from '../queue/queue.constants';
import type { PricingRunRulesJobData } from '../queue/queue.types';

/**
 * Rakip fiyatlarını ve BuyBox anlık görüntülerini periyodik günceller.
 * Gerçek pazaryeri çağrıları adaptör + kuyruk ile yapılacak; şimdilik deterministik örnek veri üretir.
 */
@Injectable()
export class CompetitorPriceTask {
  private readonly logger = new Logger(CompetitorPriceTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly competitorPriceService: CompetitorPriceService,
    private readonly buyBoxService: BuyBoxService,
    @InjectQueue(QUEUE_PRICING)
    private readonly pricingQueue: Queue<PricingRunRulesJobData>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async trackCompetitorPrices(): Promise<void> {
    const orgs = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.ACTIVE,
        plan: { in: [PlanTier.PRO, PlanTier.KURUMSAL] },
      },
      select: { organizationId: true },
    });

    for (const { organizationId } of orgs) {
      try {
        await this.syncMockCompetitorsForOrg(organizationId);
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
        this.logger.error('Rakip fiyat izleme görevi hatası', {
          organizationId,
          error: message,
        });
      }
    }
  }

  private async syncMockCompetitorsForOrg(organizationId: string): Promise<void> {
    const listings = await this.prisma.listing.findMany({
      where: { organizationId, deletedAt: null },
      take: 200,
      orderBy: { updatedAt: 'desc' },
    });

    for (const listing of listings) {
      const our = Number(listing.salePrice);
      const seed = listing.barcode.length % 5;
      const competitorCount = 2 + (seed % 3);
      const prices: Array<{
        competitorId: string;
        competitorName: string;
        price: number;
        isBuyBox: boolean;
      }> = [];

      for (let i = 0; i < competitorCount; i += 1) {
        const rel = 0.94 + i * 0.035 + seed * 0.004;
        const p = Math.round(our * rel * 100) / 100;
        prices.push({
          competitorId: `mock-${listing.platform}-${i}`,
          competitorName: `Rakip ${i + 1}`,
          price: p,
          isBuyBox: i === 0,
        });
      }

      const buyBoxCandidate = Math.min(
        ...prices.map((p) => p.price),
        our * 1.04,
      );
      const roundedBb = Math.round(buyBoxCandidate * 100) / 100;
      const isWinner = our <= roundedBb + 0.01;

      await this.competitorPriceService.recordCompetitorPrices(
        organizationId,
        listing.barcode,
        listing.platform,
        prices.map((p) => ({
          competitorId: p.competitorId,
          competitorName: p.competitorName,
          price: p.price,
          isBuyBox: p.isBuyBox,
        })),
      );

      await this.buyBoxService.saveSnapshot(
        organizationId,
        listing.barcode,
        listing.platform,
        roundedBb,
        our,
        isWinner,
        competitorCount,
      );
    }
  }
}
