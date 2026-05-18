import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Marketplace,
  Prisma,
  type BuyBoxSnapshot,
  type PriceHistory,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class BuyBoxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngine,
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

  async getBuyBoxAnalysis(
    organizationId: string,
    listingId: string,
  ): Promise<BuyBoxAnalysisResult> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId, deletedAt: null },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }

    const snapshot = await this.getMostRecentSnapshotForBarcode(
      organizationId,
      listing.platform,
      listing.barcode,
    );

    const currentPrice = Number(listing.salePrice);
    const hasBuyBox = snapshot?.isWinner ?? false;
    const buyBoxPrice = snapshot ? Number(snapshot.buyBoxPrice) : null;

    const competitorPrices: number[] = [];
    if (snapshot && snapshot.competitorCount > 0 && buyBoxPrice !== null) {
      competitorPrices.push(buyBoxPrice);
    }

    const priceGap =
      buyBoxPrice !== null ? Math.round((currentPrice - buyBoxPrice) * 100) / 100 : 0;

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
      (r) => r.applyToAll || r.barcodes.includes(listing.barcode),
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
}
