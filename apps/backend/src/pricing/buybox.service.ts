import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Marketplace,
  Prisma,
  type BuyBoxSnapshot,
  type PriceHistory,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CompetitorPriceService } from './competitor-price.service';
import { PricingEngine, type PricingEngineContext } from './pricing.engine';

export interface BuyBoxAnalysisResult {
  currentPrice: number;
  competitorPrices: number[];
  hasBuyBox: boolean;
  buyBoxPrice: number | null;
  priceGap: number;
  recommendation: string;
  suggestedPrice: number;
}

export interface BuyBoxWinRateStats {
  totalChecks: number;
  winCount: number;
  winRate: number;
  avgPriceWhenWinning: number;
  avgPriceWhenLosing: number;
}

export interface CompetitorBid {
  price: number;
}

export interface BuyBoxStatus {
  isWinner: boolean;
  currentPrice: number;
  lowestCompetitorPrice: number;
  priceGap: number;
  recommendation: 'lower' | 'hold' | 'raise';
  suggestedPrice: number;
}

export interface ListingBuyBoxStatus {
  listingId: string;
  title: string;
  barcode: string;
  platform: Marketplace;
  isWinner: boolean;
  currentPrice: number;
  lowestCompetitorPrice: number;
  buyBoxReferencePrice: number;
  priceGap: number;
  potentialRevenueLoss: number;
}

export interface BuyBoxReportResult {
  totalListings: number;
  buyBoxCount: number;
  winRate: number;
  potentialRevenueLoss: number;
  topLosers: ListingBuyBoxStatus[];
}

export interface BuyBoxHistoryRow {
  capturedAt: string;
  isWinner: boolean;
  ourPrice: number;
  buyBoxPrice: number;
  competitorCount: number;
  platform: Marketplace;
}

@Injectable()
export class BuyBoxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngine,
    private readonly competitorPriceService: CompetitorPriceService,
  ) {}

  async saveSnapshot(
    organizationId: string,
    barcode: string,
    platform: Marketplace,
    buyBoxPrice: number,
    ourPrice: number,
    isWinner: boolean,
    competitorCount: number,
  ): Promise<void> {
    await this.prisma.buyBoxSnapshot.create({
      data: {
        organizationId,
        barcode,
        platform,
        buyBoxPrice: new Prisma.Decimal(buyBoxPrice),
        ourPrice: new Prisma.Decimal(ourPrice),
        isWinner,
        competitorCount,
      },
    });
  }

  async getLatestSnapshots(
    organizationId: string,
    platform?: Marketplace,
  ): Promise<BuyBoxSnapshot[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.prisma.buyBoxSnapshot.findMany({
      where: {
        organizationId,
        ...(platform !== undefined ? { platform } : {}),
        capturedAt: { gte: since },
      },
      orderBy: { capturedAt: 'desc' },
      distinct: ['barcode', 'platform'],
    });
  }

  async getLatestSnapshotForBarcode(
    organizationId: string,
    platform: Marketplace,
    barcode: string,
  ): Promise<BuyBoxSnapshot | null> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.prisma.buyBoxSnapshot.findFirst({
      where: {
        organizationId,
        platform,
        barcode,
        capturedAt: { gte: since },
      },
      orderBy: { capturedAt: 'desc' },
    });
  }

  async getMostRecentSnapshotForBarcode(
    organizationId: string,
    platform: Marketplace,
    barcode: string,
  ): Promise<BuyBoxSnapshot | null> {
    return this.prisma.buyBoxSnapshot.findFirst({
      where: { organizationId, platform, barcode },
      orderBy: { capturedAt: 'desc' },
    });
  }

  async getWinRate(
    organizationId: string,
    platform: Marketplace,
    days = 7,
  ): Promise<number> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [total, wins] = await Promise.all([
      this.prisma.buyBoxSnapshot.count({
        where: { organizationId, platform, capturedAt: { gte: since } },
      }),
      this.prisma.buyBoxSnapshot.count({
        where: {
          organizationId,
          platform,
          isWinner: true,
          capturedAt: { gte: since },
        },
      }),
    ]);
    return total > 0 ? Math.round((wins / total) * 100) : 0;
  }

  /**
   * Platforma göre BuyBox / rekabet durumu (anlık görüntü + rakip fiyatları).
   */
  async detectBuyBoxWinner(
    organizationId: string,
    listingId: string,
  ): Promise<BuyBoxStatus> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId, deletedAt: null },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }

    const latestComps =
      await this.competitorPriceService.getLatestCompetitorPrices(
        organizationId,
        listing.barcode,
      );
    const platformComps = latestComps.filter(
      (c) => c.platform === listing.platform,
    );
    const nonBb = platformComps.filter((c) => !c.isBuyBox);
    const lowestFromComps =
      nonBb.length > 0
        ? Math.min(...nonBb.map((c) => Number(c.price)))
        : Number.POSITIVE_INFINITY;

    const snapshot = await this.getMostRecentSnapshotForBarcode(
      organizationId,
      listing.platform,
      listing.barcode,
    );

    const currentPrice = Math.round(Number(listing.salePrice) * 100) / 100;
    const buyBoxRef = snapshot ? Number(snapshot.buyBoxPrice) : null;
    const snapshotWinner = snapshot?.isWinner ?? false;

    let lowestCompetitorPrice = Number.isFinite(lowestFromComps)
      ? lowestFromComps
      : currentPrice;
    if (buyBoxRef !== null) {
      lowestCompetitorPrice = Math.min(lowestCompetitorPrice, buyBoxRef);
    }

    let isWinner = snapshotWinner;
    if (listing.platform === Marketplace.HEPSIBURADA) {
      isWinner =
        currentPrice <= lowestCompetitorPrice + 0.01 ||
        (buyBoxRef !== null && currentPrice <= buyBoxRef + 0.01);
    } else if (
      listing.platform === Marketplace.AMAZON_TR ||
      listing.platform === Marketplace.AMAZON_EU ||
      listing.platform === Marketplace.AMAZON_AE
    ) {
      isWinner = snapshotWinner;
    } else {
      isWinner = snapshotWinner;
    }

    const priceGap =
      buyBoxRef !== null
        ? Math.round((currentPrice - buyBoxRef) * 100) / 100
        : Math.round((currentPrice - lowestCompetitorPrice) * 100) / 100;

    const productRow =
      listing.productId != null
        ? await this.prisma.product.findFirst({
            where: {
              id: listing.productId,
              organizationId,
              deletedAt: null,
            },
            select: { costPrice: true },
          })
        : null;
    const costGuess =
      productRow?.costPrice != null
        ? Number(productRow.costPrice)
        : currentPrice * 0.65;

    const suggestedPrice = this.calculateOptimalPrice({
      currentPrice,
      costPrice: costGuess > 0 ? costGuess : currentPrice * 0.65,
      minMargin: minMarginPct,
      competitors: platformComps.map((c) => ({ price: Number(c.price) })),
      strategy: 'balanced',
    });

    let recommendation: BuyBoxStatus['recommendation'];
    if (isWinner && currentPrice <= (buyBoxRef ?? lowestCompetitorPrice) * 1.02) {
      recommendation = 'hold';
    } else if (currentPrice > (buyBoxRef ?? lowestCompetitorPrice)) {
      recommendation = 'lower';
    } else {
      recommendation = 'raise';
    }

    return {
      isWinner,
      currentPrice,
      lowestCompetitorPrice: Number.isFinite(lowestCompetitorPrice)
        ? lowestCompetitorPrice
        : currentPrice,
      priceGap,
      recommendation,
      suggestedPrice,
    };
  }

  /**
   * Rakip tekliflerine göre agresif / dengeli / muhafazakâr hedef fiyat.
   */
  calculateOptimalPrice(params: {
    currentPrice: number;
    costPrice: number;
    minMargin: number;
    competitors: CompetitorBid[];
    strategy: 'aggressive' | 'balanced' | 'conservative';
  }): number {
    const { currentPrice, costPrice, minMargin, competitors, strategy } = params;
    const minPrice =
      costPrice > 0
        ? Math.round(costPrice * (1 + minMargin / 100) * 100) / 100
        : Math.round(currentPrice * 0.85 * 100) / 100;

    const prices = competitors
      .map((c) => c.price)
      .filter((p) => p > 0 && Number.isFinite(p));
    if (prices.length === 0) {
      return Math.max(currentPrice, minPrice);
    }

    const minComp = Math.min(...prices);
    const avg =
      prices.reduce((a, b) => a + b, 0) / Math.max(1, prices.length);

    let raw: number;
    if (strategy === 'aggressive') {
      raw = minComp - 0.01;
    } else if (strategy === 'balanced') {
      raw = minComp * 0.99;
    } else {
      raw = avg * 0.98;
    }

    return Math.max(Math.round(raw * 100) / 100, minPrice);
  }

  async getBuyBoxHistory(
    organizationId: string,
    listingId: string,
    days: number,
  ): Promise<BuyBoxHistoryRow[]> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId, deletedAt: null },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }
    const safeDays = Math.min(Math.max(days, 1), 365);
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.buyBoxSnapshot.findMany({
      where: {
        organizationId,
        barcode: listing.barcode,
        platform: listing.platform,
        capturedAt: { gte: since },
      },
      orderBy: { capturedAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => ({
      capturedAt: r.capturedAt.toISOString(),
      isWinner: r.isWinner,
      ourPrice: Number(r.ourPrice),
      buyBoxPrice: Number(r.buyBoxPrice),
      competitorCount: r.competitorCount,
      platform: r.platform,
    }));
  }

  async getBuyBoxReport(organizationId: string): Promise<BuyBoxReportResult> {
    const listings = await this.prisma.listing.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        title: true,
        barcode: true,
        platform: true,
        salePrice: true,
      },
    });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const snaps = await this.prisma.buyBoxSnapshot.findMany({
      where: { organizationId, capturedAt: { gte: since } },
      orderBy: { capturedAt: 'desc' },
    });
    const latestByKey = new Map<string, BuyBoxSnapshot>();
    for (const s of snaps) {
      const k = `${s.barcode}\u0000${s.platform}`;
      if (!latestByKey.has(k)) {
        latestByKey.set(k, s);
      }
    }

    let buyBoxCount = 0;
    const losers: ListingBuyBoxStatus[] = [];
    let potentialRevenueLoss = 0;

    for (const l of listings) {
      const snap = latestByKey.get(`${l.barcode}\u0000${l.platform}`);
      if (!snap) {
        continue;
      }
      const current = Number(l.salePrice);
      const bb = Number(snap.buyBoxPrice);
      if (snap.isWinner) {
        buyBoxCount += 1;
        continue;
      }
      const gap = Math.round((current - bb) * 100) / 100;
      const lossUnit = Math.max(0, gap);
      const assumedDailyUnits = 3;
      const rowLoss = lossUnit * assumedDailyUnits;
      potentialRevenueLoss += rowLoss;
      losers.push({
        listingId: l.id,
        title: l.title,
        barcode: l.barcode,
        platform: l.platform,
        isWinner: false,
        currentPrice: current,
        lowestCompetitorPrice: bb,
        buyBoxReferencePrice: bb,
        priceGap: gap,
        potentialRevenueLoss: Math.round(rowLoss * 100) / 100,
      });
    }

    losers.sort((a, b) => b.potentialRevenueLoss - a.potentialRevenueLoss);

    const totalListings = listings.length;
    const winRate =
      totalListings > 0 ? buyBoxCount / totalListings : 0;

    return {
      totalListings,
      buyBoxCount,
      winRate: Math.round(winRate * 10_000) / 10_000,
      potentialRevenueLoss: Math.round(potentialRevenueLoss * 100) / 100,
      topLosers: losers.slice(0, 25),
    };
  }

  async getBuyBoxAnalysis(
    organizationId: string,
    listingId: string,
  ): Promise<BuyBoxAnalysisResult> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId, deletedAt: null },
      include: {
        product: {
          select: { category: true, brand: true, sku: true },
        },
      },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }

    const snapshot = await this.getMostRecentSnapshotForBarcode(
      organizationId,
      listing.platform,
      listing.barcode,
    );

    const latestComps =
      await this.competitorPriceService.getLatestCompetitorPrices(
        organizationId,
        listing.barcode,
      );
    const platformComps = latestComps.filter(
      (c) => c.platform === listing.platform,
    );

    const currentPrice = Number(listing.salePrice);
    const hasBuyBox = snapshot?.isWinner ?? false;
    const buyBoxPrice = snapshot ? Number(snapshot.buyBoxPrice) : null;

    const competitorPrices: number[] = [];
    for (const c of platformComps) {
      competitorPrices.push(Number(c.price));
    }
    if (snapshot && snapshot.competitorCount > 0 && buyBoxPrice !== null) {
      if (!competitorPrices.includes(buyBoxPrice)) {
        competitorPrices.push(buyBoxPrice);
      }
    }

    const priceGap =
      buyBoxPrice !== null
        ? Math.round((currentPrice - buyBoxPrice) * 100) / 100
        : 0;

    const rules = await this.prisma.pricingRule.findMany({
      where: {
        organizationId,
        platform: listing.platform,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
    const rule = rules.find(
      (r) =>
        (r.applyToAll || r.barcodes.includes(listing.barcode)) &&
        this.pricingEngine.isRuleActiveNow(r) &&
        this.pricingEngine.ruleAppliesToListing(r, {
          barcode: listing.barcode,
          product: listing.product,
        }),
    );

    const engineCtx: PricingEngineContext = {
      stock: listing.quantity,
      hasBuyBox,
    };

    const buyBoxForEngine = buyBoxPrice ?? currentPrice;

    let suggestedPrice = currentPrice;
    if (rule) {
      const computed = this.pricingEngine.calculateOptimalPrice(
        rule,
        currentPrice,
        buyBoxForEngine,
        rule.costPrice != null ? Number(rule.costPrice) : null,
        engineCtx,
      );
      if (computed !== null) {
        suggestedPrice = computed;
      }
    } else if (buyBoxPrice !== null && !hasBuyBox) {
      suggestedPrice = Math.max(
        Math.round((buyBoxPrice - 0.01) * 100) / 100,
        currentPrice * 0.5,
      );
    }

    let recommendation: string;
    if (!snapshot) {
      recommendation =
        'Bu ürün için henüz BuyBox anlık görüntüsü yok. Fiyat senkronizasyonunu bekleyin.';
    } else if (hasBuyBox) {
      recommendation =
        'BuyBox şu an sizde. Marjınızı korumak için fiyatı kademeli artırmayı ve rakip hareketlerini izlemeyi düşünebilirsiniz.';
    } else if (buyBoxPrice !== null && currentPrice > buyBoxPrice) {
      recommendation =
        'Fiyatınız BuyBox üzerinde; rekabet için önerilen fiyat seviyesine yaklaşmanız faydalı olabilir.';
    } else if (buyBoxPrice !== null && currentPrice < buyBoxPrice) {
      recommendation =
        'Fiyatınız BuyBox altında; minimum marj ve kurallarınızı gözden geçirerek sürdürülebilirliği kontrol edin.';
    } else {
      recommendation =
        'BuyBox verisi mevcut; aktif fiyat kuralınız veya önerilen fiyat ile stratejinizi netleştirin.';
    }

    return {
      currentPrice,
      competitorPrices,
      hasBuyBox,
      buyBoxPrice,
      priceGap,
      recommendation,
      suggestedPrice,
    };
  }

  async getBuyBoxWinRate(
    organizationId: string,
    days = 7,
  ): Promise<BuyBoxWinRateStats> {
    const safeDays = Math.min(Math.max(days, 1), 365);
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const [totalChecks, winCount, winAgg, loseAgg] = await Promise.all([
      this.prisma.buyBoxSnapshot.count({
        where: { organizationId, capturedAt: { gte: since } },
      }),
      this.prisma.buyBoxSnapshot.count({
        where: {
          organizationId,
          isWinner: true,
          capturedAt: { gte: since },
        },
      }),
      this.prisma.buyBoxSnapshot.aggregate({
        where: {
          organizationId,
          isWinner: true,
          capturedAt: { gte: since },
        },
        _avg: { ourPrice: true },
      }),
      this.prisma.buyBoxSnapshot.aggregate({
        where: {
          organizationId,
          isWinner: false,
          capturedAt: { gte: since },
        },
        _avg: { ourPrice: true },
      }),
    ]);

    const winRate = totalChecks > 0 ? winCount / totalChecks : 0;

    return {
      totalChecks,
      winCount,
      winRate,
      avgPriceWhenWinning:
        winCount > 0 ? Number(winAgg._avg.ourPrice ?? 0) : 0,
      avgPriceWhenLosing:
        totalChecks - winCount > 0
          ? Number(loseAgg._avg.ourPrice ?? 0)
          : 0,
    };
  }

  async getPriceHistory(
    organizationId: string,
    barcode: string,
    platform: Marketplace,
  ): Promise<PriceHistory[]> {
    return this.prisma.priceHistory.findMany({
      where: { organizationId, barcode, platform },
      orderBy: { appliedAt: 'desc' },
      take: 30,
    });
  }

  async getVelocityPerDay(
    organizationId: string,
    barcode: string,
    platform: Marketplace,
  ): Promise<number> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const agg = await this.prisma.orderItem.aggregate({
      where: {
        organizationId,
        barcode,
        order: {
          platform,
          deletedAt: null,
          createdAt: { gte: since },
        },
      },
      _sum: { quantity: true },
    });
    const total = agg._sum.quantity ?? 0;
    return Math.round((total / 7) * 100) / 100;
  }
}
