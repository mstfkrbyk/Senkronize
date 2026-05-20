import { Process, Processor } from '@nestjs/bull';
import { InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bull';
import type { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_MARKETPLACE_PUSH,
  QUEUE_PRICING,
} from '../queue/queue.constants';
import type {
  MarketplacePushJobData,
  PricingRunRulesJobData,
} from '../queue/queue.types';

import { BuyBoxService } from '../pricing/buybox.service';
import { PriceHistoryService } from '../pricing/price-history.service';
import { PricingEngine } from '../pricing/pricing.engine';

@Processor(QUEUE_PRICING)
export class PricingProcessor {
  private readonly logger = new Logger(PricingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buyboxService: BuyBoxService,
    private readonly engine: PricingEngine,
    private readonly priceHistoryService: PriceHistoryService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly pushQueue: Queue<MarketplacePushJobData>,
  ) {}

  @Process('run-rules')
  async handleRunRules(job: Job<PricingRunRulesJobData>): Promise<void> {
    const { organizationId } = job.data;

    const rules = await this.prisma.pricingRule.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
    });

    for (const rule of rules) {
      if (!this.engine.isRuleActiveNow(rule)) {
        continue;
      }
      const where = {
        organizationId,
        platform: rule.platform,
        deletedAt: null,
        ...(rule.applyToAll ? {} : { barcode: { in: rule.barcodes } }),
      };
      const listings = await this.prisma.listing.findMany({
        where,
        include: {
          product: {
            select: {
              category: true,
              brand: true,
              sku: true,
              reorderPoint: true,
            },
          },
        },
      });

      for (const listing of listings) {
        if (
          !this.engine.ruleAppliesToListing(rule, {
            barcode: listing.barcode,
            product: listing.product,
          })
        ) {
          continue;
        }
        const snapshot = await this.buyboxService.getLatestSnapshotForBarcode(
          organizationId,
          rule.platform,
          listing.barcode,
        );

        if (!snapshot) {
          continue;
        }

        const velocity = await this.buyboxService.getVelocityPerDay(
          organizationId,
          listing.barcode,
          listing.platform,
        );

        const newPrice = this.engine.calculateOptimalPrice(
          rule,
          Number(listing.salePrice),
          Number(snapshot.buyBoxPrice),
          rule.costPrice != null ? rule.costPrice : null,
          {
            stock: listing.quantity,
            hasBuyBox: snapshot.isWinner,
            velocityPerDay: velocity,
            reorderPoint: listing.product?.reorderPoint ?? null,
          },
        );

        if (newPrice === null) {
          continue;
        }
        if (
          !this.engine.shouldUpdatePrice(Number(listing.salePrice), newPrice)
        ) {
          continue;
        }

        await this.pushQueue.add(
          'push-price',
          {
            organizationId,
            platform: rule.platform,
            type: 'price',
            resourceIds: [listing.barcode],
            payload: {
              salePrice: newPrice,
              listPrice: Number(listing.listPrice),
            },
          },
          JOB_DEFAULT_OPTIONS,
        );

        await this.prisma.$transaction(async (tx) => {
          await this.priceHistoryService.recordPriceChange(
            {
              organizationId,
              listingId: listing.id,
              barcode: listing.barcode,
              platform: rule.platform,
              oldPrice: listing.salePrice,
              newPrice,
              source: 'rule',
              pricingRuleId: rule.id,
              reason: rule.name,
            },
            tx,
          );
          await tx.listing.update({
            where: { id: listing.id },
            data: { salePrice: new Prisma.Decimal(newPrice) },
          });
        });

        this.logger.log(
          `Fiyat güncellendi: ${listing.barcode} ${listing.salePrice} → ${newPrice}`,
        );
      }
    }
  }
}
