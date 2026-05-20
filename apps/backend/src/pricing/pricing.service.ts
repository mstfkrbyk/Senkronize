import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Marketplace,
  Prisma,
  type PricingRule,
  type PricingStrategy,
} from '@prisma/client';
import type { Queue } from 'bull';

import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import {
  JOB_DEFAULT_OPTIONS,
  LISTING_SYNC_JOB_OPTIONS,
  QUEUE_LISTING_SYNC,
  QUEUE_MARKETPLACE_PUSH,
  QUEUE_PRICING,
} from '../queue/queue.constants';
import type {
  ListingSyncBatchJobData,
  MarketplacePushJobData,
  PricingRunRulesJobData,
} from '../queue/queue.types';

import type {
  BuyBoxAnalysisResult,
  BuyBoxHistoryRow,
  BuyBoxReportResult,
  BuyBoxStatus,
  BuyBoxWinRateStats,
} from './buybox.service';
import { BuyBoxService } from './buybox.service';
import type {
  CreatePricingRuleDto,
  ManualPriceUpdateDto,
  PriceHistoryQueryDto,
  SchedulePricingRuleDto,
  SimulatePriceDto,
  SimulatePricingRuleDto,
  UpdatePricingRuleDto,
} from './pricing.dto';
import { PricingEngine } from './pricing.engine';
import { PriceHistoryService } from './price-history.service';

export interface BuyBoxSummaryResponse {
  totalListings: number;
  winningBuyBox: number;
  winRate: number;
  activeRules: number;
  platforms: Array<{ platform: string; winRate: number; listings: number }>;
  snapshots: Array<{
    barcode: string;
    platform: Marketplace;
    buyBoxPrice: string;
    ourPrice: string;
    isWinner: boolean;
    competitorCount: number;
    capturedAt: string;
  }>;
}

export interface PriceHistoryItemResponse {
  id: string;
  barcode: string;
  platform: Marketplace;
  oldPrice: string;
  newPrice: string;
  reason: string | null;
  appliedAt: string;
  pricingRuleId: string | null;
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PricingEngine,
    private readonly buybox: BuyBoxService,
    private readonly eventService: EventService,
    private readonly priceHistoryService: PriceHistoryService,
    @InjectQueue(QUEUE_PRICING)
    private readonly pricingQueue: Queue<PricingRunRulesJobData>,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly pushQueue: Queue<MarketplacePushJobData>,
    @InjectQueue(QUEUE_LISTING_SYNC)
    private readonly listingSyncQueue: Queue<ListingSyncBatchJobData>,
  ) {}

  private assertValidSkuPattern(pattern: string | null | undefined): void {
    if (pattern === null || pattern === undefined) {
      return;
    }
    const t = pattern.trim();
    if (t.length === 0) {
      return;
    }
    try {
      // eslint-disable-next-line no-new -- deseni doğrulamak için
      new RegExp(t);
    } catch {
      throw new BadRequestException('Geçersiz SKU deseni');
    }
  }

  private parseOptionalIsoDate(value: string | undefined): Date | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Geçersiz tarih/saat');
    }
    return d;
  }

  async createRule(
    organizationId: string,
    dto: CreatePricingRuleDto,
  ): Promise<PricingRule> {
    const applyToAll = dto.applyToAll ?? false;
    const barcodes = dto.barcodes ?? [];
    if (!applyToAll && barcodes.length === 0) {
      throw new BadRequestException(
        'applyToAll false ise en az bir barkod gerekir',
      );
    }

    this.assertValidSkuPattern(dto.skuPattern);

    return this.prisma.pricingRule.create({
      data: {
        organizationId,
        name: dto.name,
        platform: dto.platform,
        strategy: dto.strategy,
        minMarginPct: new Prisma.Decimal(dto.minMarginPct ?? 10),
        maxDiscountPct: new Prisma.Decimal(dto.maxDiscountPct ?? 20),
        targetPosition: dto.targetPosition ?? 1,
        applyToAll,
        barcodes: applyToAll ? [] : barcodes,
        ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}),
        ...(dto.minMarginPercent !== undefined
          ? { minMarginPercent: dto.minMarginPercent }
          : {}),
        ...(dto.stepAmount !== undefined ? { stepAmount: dto.stepAmount } : {}),
        ...(dto.nightDiscountPercent !== undefined
          ? { nightDiscountPercent: dto.nightDiscountPercent }
          : {}),
        ...(dto.peakPremiumPercent !== undefined
          ? { peakPremiumPercent: dto.peakPremiumPercent }
          : {}),
        ...(dto.lowStockThreshold !== undefined
          ? { lowStockThreshold: dto.lowStockThreshold }
          : {}),
        ...(dto.highStockThreshold !== undefined
          ? { highStockThreshold: dto.highStockThreshold }
          : {}),
        ...(dto.maxPrice !== undefined ? { maxPrice: dto.maxPrice } : {}),
        ...(dto.scheduledStart != null &&
          dto.scheduledStart !== '' && {
            scheduledStart: this.parseOptionalIsoDate(dto.scheduledStart) as Date,
          }),
        ...(dto.scheduledEnd != null &&
          dto.scheduledEnd !== '' && {
            scheduledEnd: this.parseOptionalIsoDate(dto.scheduledEnd) as Date,
          }),
        ...(dto.daysOfWeek !== undefined ? { daysOfWeek: dto.daysOfWeek } : {}),
        ...(dto.hoursStart !== undefined ? { hoursStart: dto.hoursStart } : {}),
        ...(dto.hoursEnd !== undefined ? { hoursEnd: dto.hoursEnd } : {}),
        ...(dto.categoryFilter !== undefined
          ? { categoryFilter: dto.categoryFilter }
          : {}),
        ...(dto.brandFilter !== undefined ? { brandFilter: dto.brandFilter } : {}),
        ...(dto.skuPattern !== undefined ? { skuPattern: dto.skuPattern } : {}),
      },
    });
  }

  async findRules(organizationId: string): Promise<PricingRule[]> {
    return this.prisma.pricingRule.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRule(
    organizationId: string,
    id: string,
    dto: UpdatePricingRuleDto,
  ): Promise<PricingRule> {
    const existing = await this.prisma.pricingRule.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Fiyat kuralı bulunamadı');
    }

    const nextApplyToAll = dto.applyToAll ?? existing.applyToAll;
    const nextBarcodes =
      dto.applyToAll === true
        ? []
        : (dto.barcodes ?? existing.barcodes);

    if (!nextApplyToAll && nextBarcodes.length === 0) {
      throw new BadRequestException(
        'applyToAll false ise en az bir barkod gerekir',
      );
    }

    this.assertValidSkuPattern(dto.skuPattern);

    return this.prisma.pricingRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.platform !== undefined && { platform: dto.platform }),
        ...(dto.strategy !== undefined && { strategy: dto.strategy }),
        ...(dto.minMarginPct !== undefined && {
          minMarginPct: new Prisma.Decimal(dto.minMarginPct),
        }),
        ...(dto.maxDiscountPct !== undefined && {
          maxDiscountPct: new Prisma.Decimal(dto.maxDiscountPct),
        }),
        ...(dto.targetPosition !== undefined && {
          targetPosition: dto.targetPosition,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.minMarginPercent !== undefined && {
          minMarginPercent: dto.minMarginPercent,
        }),
        ...(dto.stepAmount !== undefined && { stepAmount: dto.stepAmount }),
        ...(dto.nightDiscountPercent !== undefined && {
          nightDiscountPercent: dto.nightDiscountPercent,
        }),
        ...(dto.peakPremiumPercent !== undefined && {
          peakPremiumPercent: dto.peakPremiumPercent,
        }),
        ...(dto.lowStockThreshold !== undefined && {
          lowStockThreshold: dto.lowStockThreshold,
        }),
        ...(dto.highStockThreshold !== undefined && {
          highStockThreshold: dto.highStockThreshold,
        }),
        ...(dto.maxPrice !== undefined && { maxPrice: dto.maxPrice }),
        applyToAll: nextApplyToAll,
        barcodes: nextBarcodes,
        ...(dto.scheduledStart !== undefined && {
          scheduledStart:
            dto.scheduledStart === null || dto.scheduledStart === ''
              ? null
              : this.parseOptionalIsoDate(dto.scheduledStart),
        }),
        ...(dto.scheduledEnd !== undefined && {
          scheduledEnd:
            dto.scheduledEnd === null || dto.scheduledEnd === ''
              ? null
              : this.parseOptionalIsoDate(dto.scheduledEnd),
        }),
        ...(dto.daysOfWeek !== undefined && { daysOfWeek: dto.daysOfWeek }),
        ...(dto.hoursStart !== undefined && { hoursStart: dto.hoursStart }),
        ...(dto.hoursEnd !== undefined && { hoursEnd: dto.hoursEnd }),
        ...(dto.categoryFilter !== undefined && {
          categoryFilter: dto.categoryFilter,
        }),
        ...(dto.brandFilter !== undefined && { brandFilter: dto.brandFilter }),
        ...(dto.skuPattern !== undefined && { skuPattern: dto.skuPattern }),
      },
    });
  }

  async scheduleRule(
    organizationId: string,
    ruleId: string,
    dto: SchedulePricingRuleDto,
  ): Promise<PricingRule> {
    const existing = await this.prisma.pricingRule.findFirst({
      where: { id: ruleId, organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Fiyat kuralı bulunamadı');
    }

    if (
      (dto.hoursStart !== undefined && dto.hoursEnd === undefined) ||
      (dto.hoursEnd !== undefined && dto.hoursStart === undefined)
    ) {
      throw new BadRequestException(
        'Saat aralığı için başlangıç ve bitiş birlikte gönderilmelidir',
      );
    }

    const nextStart =
      dto.scheduledStart !== undefined
        ? dto.scheduledStart === null || dto.scheduledStart === ''
          ? null
          : this.parseOptionalIsoDate(dto.scheduledStart)
        : undefined;
    const nextEnd =
      dto.scheduledEnd !== undefined
        ? dto.scheduledEnd === null || dto.scheduledEnd === ''
          ? null
          : this.parseOptionalIsoDate(dto.scheduledEnd)
        : undefined;

    if (nextStart != null && nextEnd != null && nextStart > nextEnd) {
      throw new BadRequestException('Başlangıç zamanı bitişten sonra olamaz');
    }

    return this.prisma.pricingRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.scheduledStart !== undefined && { scheduledStart: nextStart }),
        ...(dto.scheduledEnd !== undefined && { scheduledEnd: nextEnd }),
        ...(dto.daysOfWeek !== undefined && { daysOfWeek: dto.daysOfWeek }),
        ...(dto.hoursStart !== undefined && { hoursStart: dto.hoursStart }),
        ...(dto.hoursEnd !== undefined && { hoursEnd: dto.hoursEnd }),
      },
    });
  }

  async getScheduledRules(organizationId: string): Promise<PricingRule[]> {
    const rows = await this.prisma.pricingRule.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { scheduledStart: { not: null } },
          { scheduledEnd: { not: null } },
          { daysOfWeek: { isEmpty: false } },
          { hoursStart: { not: null } },
          { hoursEnd: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.filter(
      (r) =>
        this.engine.hasScheduleConfiguration(r) && !this.engine.isRuleActiveNow(r),
    );
  }

  async deleteRule(organizationId: string, id: string): Promise<void> {
    const existing = await this.prisma.pricingRule.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Fiyat kuralı bulunamadı');
    }
    await this.prisma.pricingRule.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getBuyBoxSummary(organizationId: string): Promise<BuyBoxSummaryResponse> {
    const [totalListings, activeRules, latestSnapshots, since7d] =
      await Promise.all([
        this.prisma.listing.count({
          where: { organizationId, deletedAt: null },
        }),
        this.prisma.pricingRule.count({
          where: { organizationId, deletedAt: null, isActive: true },
        }),
        this.buybox.getLatestSnapshots(organizationId),
        Promise.all([
          this.prisma.buyBoxSnapshot.count({
            where: {
              organizationId,
              capturedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          }),
          this.prisma.buyBoxSnapshot.count({
            where: {
              organizationId,
              isWinner: true,
              capturedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          }),
        ]),
      ]);

    const [snapTotal7d, snapWins7d] = since7d;
    const winRate =
      snapTotal7d > 0 ? Math.round((snapWins7d / snapTotal7d) * 100) : 0;

    const winningBuyBox = latestSnapshots.filter((s) => s.isWinner).length;

    const platformRows = await this.prisma.listing.groupBy({
      by: ['platform'],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
    });

    const platforms: BuyBoxSummaryResponse['platforms'] = [];
    for (const row of platformRows) {
      const wr = await this.buybox.getWinRate(organizationId, row.platform, 7);
      platforms.push({
        platform: row.platform,
        winRate: wr,
        listings: row._count._all,
      });
    }

    return {
      totalListings,
      winningBuyBox,
      winRate,
      activeRules,
      platforms,
      snapshots: latestSnapshots.map((s) => ({
        barcode: s.barcode,
        platform: s.platform,
        buyBoxPrice: s.buyBoxPrice.toString(),
        ourPrice: s.ourPrice.toString(),
        isWinner: s.isWinner,
        competitorCount: s.competitorCount,
        capturedAt: s.capturedAt.toISOString(),
      })),
    };
  }

  async getSnapshotsForBarcode(
    organizationId: string,
    barcode: string,
    platform?: Marketplace,
  ): Promise<
    Array<{
      buyBoxPrice: string;
      ourPrice: string;
      isWinner: boolean;
      competitorCount: number;
      capturedAt: string;
      platform: Marketplace;
    }>
  > {
    const rows = await this.prisma.buyBoxSnapshot.findMany({
      where: {
        organizationId,
        barcode,
        ...(platform !== undefined ? { platform } : {}),
        capturedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { capturedAt: 'desc' },
      take: 100,
    });
    return rows.map((s) => ({
      platform: s.platform,
      buyBoxPrice: s.buyBoxPrice.toString(),
      ourPrice: s.ourPrice.toString(),
      isWinner: s.isWinner,
      competitorCount: s.competitorCount,
      capturedAt: s.capturedAt.toISOString(),
    }));
  }

  async runRulesForOrg(organizationId: string): Promise<{ jobId: string }> {
    const job = await this.pricingQueue.add(
      'run-rules',
      { organizationId },
      {
        ...STANDARD_QUEUE_JOB_OPTIONS,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    return { jobId: String(job.id) };
  }

  async manualUpdate(
    organizationId: string,
    dto: ManualPriceUpdateDto,
  ): Promise<void> {
    const listing = await this.prisma.listing.findFirst({
      where: {
        organizationId,
        barcode: dto.barcode,
        platform: dto.platform,
        deletedAt: null,
      },
    });
    if (!listing) {
      throw new NotFoundException('Listing bulunamadı');
    }

    await this.priceHistoryService.recordPriceChange({
      organizationId,
      listingId: listing.id,
      barcode: dto.barcode,
      platform: dto.platform,
      oldPrice: listing.salePrice,
      newPrice: dto.salePrice,
      source: 'manual',
      reason: 'manual',
    });

    await this.prisma.listing.update({
      where: { id: listing.id },
      data: {
        salePrice: new Prisma.Decimal(dto.salePrice),
        listPrice: new Prisma.Decimal(dto.listPrice),
      },
    });

    if (listing.productId) {
      await this.afterPriceChange(listing.productId, organizationId);
    } else {
      await this.listingSyncQueue.add(
        'sync-batch',
        {
          orgId: organizationId,
          platform: dto.platform,
          updates: [
            {
              barcode: dto.barcode,
              listingId: listing.id,
              price: dto.salePrice,
              listPrice: dto.listPrice,
            },
          ],
        },
        LISTING_SYNC_JOB_OPTIONS,
      );
    }

    this.eventService.emit(organizationId, WS_EVENTS.PRICE_UPDATED, {
      barcode: dto.barcode,
    });
  }

  async afterPriceChange(productId: string, orgId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
      select: { barcode: true },
    });
    if (!product) {
      return;
    }

    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ productId }, { barcode: product.barcode }],
      },
      select: {
        id: true,
        platform: true,
        barcode: true,
        salePrice: true,
        listPrice: true,
      },
    });
    if (listings.length === 0) {
      return;
    }

    const byPlatform = new Map<Marketplace, typeof listings>();
    for (const row of listings) {
      const list = byPlatform.get(row.platform) ?? [];
      list.push(row);
      byPlatform.set(row.platform, list);
    }

    for (const [platform, rows] of byPlatform) {
      await this.listingSyncQueue.add(
        'sync-batch',
        {
          orgId,
          platform,
          updates: rows.map((listing) => ({
            barcode: listing.barcode,
            listingId: listing.id,
            price: Number(listing.salePrice),
            listPrice: Number(listing.listPrice),
          })),
        },
        LISTING_SYNC_JOB_OPTIONS,
      );
    }
  }

  async findPriceHistory(
    organizationId: string,
    query: PriceHistoryQueryDto,
  ): Promise<{ items: PriceHistoryItemResponse[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PriceHistoryWhereInput = {
      organizationId,
      ...(query.barcode !== undefined && { barcode: query.barcode }),
      ...(query.platform !== undefined && { platform: query.platform }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.priceHistory.findMany({
        where,
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.priceHistory.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        barcode: r.barcode,
        platform: r.platform,
        oldPrice: r.oldPrice.toString(),
        newPrice: r.newPrice.toString(),
        reason: r.reason,
        appliedAt: r.appliedAt.toISOString(),
        pricingRuleId: r.pricingRuleId,
      })),
      total,
    };
  }

  async getBuyBoxListingAnalysis(
    organizationId: string,
    listingId: string,
  ): Promise<BuyBoxAnalysisResult> {
    return this.buybox.getBuyBoxAnalysis(organizationId, listingId);
  }

  async getBuyBoxWinRateStats(
    organizationId: string,
    days?: number,
  ): Promise<BuyBoxWinRateStats> {
    return this.buybox.getBuyBoxWinRate(organizationId, days ?? 7);
  }

  async simulateRule(
    organizationId: string,
    ruleId: string,
    dto: SimulatePricingRuleDto,
  ): Promise<{ suggestedPrice: number | null; strategy: PricingStrategy }> {
    const rule = await this.prisma.pricingRule.findFirst({
      where: { id: ruleId, organizationId, deletedAt: null },
    });
    if (!rule) {
      throw new NotFoundException('Fiyat kuralı bulunamadı');
    }

    const referencePrice = dto.competitorPrice ?? dto.currentPrice;
    const suggestedPrice = this.engine.calculateOptimalPrice(
      rule,
      dto.currentPrice,
      referencePrice,
      rule.costPrice != null ? rule.costPrice : null,
      {
        stock: dto.stock ?? 0,
        hasBuyBox: dto.hasBuyBox ?? false,
      },
    );

    return { suggestedPrice, strategy: rule.strategy };
  }

  async getBuyBoxReport(organizationId: string): Promise<BuyBoxReportResult> {
    return this.buybox.getBuyBoxReport(organizationId);
  }

  async getBuyBoxHistoryForListing(
    organizationId: string,
    listingId: string,
    days: number,
  ): Promise<BuyBoxHistoryRow[]> {
    return this.buybox.getBuyBoxHistory(organizationId, listingId, days);
  }

  async detectBuyBoxStatus(
    organizationId: string,
    listingId: string,
  ): Promise<BuyBoxStatus> {
    return this.buybox.detectBuyBoxWinner(organizationId, listingId);
  }

  async simulatePrice(
    organizationId: string,
    dto: SimulatePriceDto,
  ): Promise<{
    currentPrice: number;
    simulatedPrice: number;
    marginImpact: {
      currentMarginPct: number | null;
      simulatedMarginPct: number | null;
    };
    estimatedBuyBoxProbability: number;
    estimatedRevenueDelta: number;
    referenceLowestPrice: number;
  }> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: dto.listingId, organizationId, deletedAt: null },
      include: { product: { select: { costPrice: true } } },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }

    const currentPrice = Number(listing.salePrice);
    const simulatedPrice = Math.round(dto.salePrice * 100) / 100;
    const costRaw =
      dto.costPrice ??
      (listing.product?.costPrice != null
        ? Number(listing.product.costPrice)
        : null);

    const baseline = await this.buybox.detectBuyBoxWinner(
      organizationId,
      listing.id,
    );

    const referenceLowest = baseline.lowestCompetitorPrice;

    const marginOf = (price: number, cost: number | null): number | null => {
      if (cost === null || cost <= 0 || price <= 0) {
        return null;
      }
      return Math.round(((price - cost) / price) * 10_000) / 100;
    };

    const marginImpact = {
      currentMarginPct: marginOf(currentPrice, costRaw),
      simulatedMarginPct: marginOf(simulatedPrice, costRaw),
    };

    let estimatedBuyBoxProbability = 0.5;
    if (referenceLowest > 0) {
      if (simulatedPrice <= referenceLowest + 0.01) {
        estimatedBuyBoxProbability = 0.88;
      } else {
        const over = (simulatedPrice - referenceLowest) / referenceLowest;
        estimatedBuyBoxProbability = Math.max(0.04, 0.88 - over * 1.6);
      }
    }

    const velocity = await this.buybox.getVelocityPerDay(
      organizationId,
      listing.barcode,
      listing.platform,
    );
    const demandUnits = Math.max(velocity, 0.5);
    const estimatedRevenueDelta =
      Math.round((simulatedPrice - currentPrice) * demandUnits * 7 * 100) /
      100;

    return {
      currentPrice,
      simulatedPrice,
      marginImpact,
      estimatedBuyBoxProbability:
        Math.round(estimatedBuyBoxProbability * 1000) / 1000,
      estimatedRevenueDelta,
      referenceLowestPrice: referenceLowest,
    };
  }

  async findPriceHistoryByBarcode(
    organizationId: string,
    barcode: string,
    platform?: Marketplace,
  ): Promise<PriceHistoryItemResponse[]> {
    const rows = await this.prisma.priceHistory.findMany({
      where: {
        organizationId,
        barcode,
        ...(platform !== undefined ? { platform } : {}),
      },
      orderBy: { appliedAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      barcode: r.barcode,
      platform: r.platform,
      oldPrice: r.oldPrice.toString(),
      newPrice: r.newPrice.toString(),
      reason: r.reason,
      appliedAt: r.appliedAt.toISOString(),
      pricingRuleId: r.pricingRuleId,
    }));
  }
}
