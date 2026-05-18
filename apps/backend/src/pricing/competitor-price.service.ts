import { Injectable } from '@nestjs/common';
import { Marketplace, Prisma, type CompetitorPrice } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface CompetitorPriceInput {
  competitorId: string;
  competitorName?: string | null;
  price: number;
  currency?: string;
  isBuyBox?: boolean;
}

export interface PriceGapPlatformRow {
  platform: Marketplace;
  ourSalePrice: number | null;
  ourListPrice: number | null;
  buyBoxPrice: number | null;
  gapTry: number | null;
  gapPct: number | null;
  competitorCount: number;
}

export interface PriceGapAnalysis {
  barcode: string;
  platforms: PriceGapPlatformRow[];
}

export interface PriceTrendPoint {
  /** YYYY-MM-DD (İstanbul takvim günü) */
  date: string;
  ourPrice: number | null;
  buyBoxPrice: number | null;
  avgCompetitorPrice: number | null;
}

@Injectable()
export class CompetitorPriceService {
  constructor(private readonly prisma: PrismaService) {}

  async recordCompetitorPrices(
    organizationId: string,
    barcode: string,
    platform: Marketplace,
    prices: CompetitorPriceInput[],
  ): Promise<void> {
    if (prices.length === 0) {
      return;
    }
    await this.prisma.competitorPrice.createMany({
      data: prices.map((p) => ({
        organizationId,
        barcode,
        platform,
        competitorId: p.competitorId,
        competitorName: p.competitorName ?? null,
        price: new Prisma.Decimal(p.price),
        currency: p.currency ?? 'TRY',
        isBuyBox: p.isBuyBox ?? false,
      })),
    });
  }

  async getLatestCompetitorPrices(
    organizationId: string,
    barcode: string,
  ): Promise<CompetitorPrice[]> {
    const rows = await this.prisma.competitorPrice.findMany({
      where: { organizationId, barcode },
      orderBy: { capturedAt: 'desc' },
      take: 500,
    });
    const seen = new Set<string>();
    const latest: CompetitorPrice[] = [];
    for (const row of rows) {
      const key = `${row.platform}:${row.competitorId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      latest.push(row);
    }
    return latest;
  }

  async getBuyBoxPrice(
    organizationId: string,
    barcode: string,
    platform: Marketplace,
  ): Promise<Prisma.Decimal | null> {
    const row = await this.prisma.competitorPrice.findFirst({
      where: { organizationId, barcode, platform, isBuyBox: true },
      orderBy: { capturedAt: 'desc' },
    });
    return row?.price ?? null;
  }

  async getPriceGapAnalysis(
    organizationId: string,
    barcode: string,
  ): Promise<PriceGapAnalysis> {
    const [listings, compRows] = await Promise.all([
      this.prisma.listing.findMany({
        where: { organizationId, barcode, deletedAt: null },
        select: {
          platform: true,
          salePrice: true,
          listPrice: true,
        },
      }),
      this.getLatestCompetitorPrices(organizationId, barcode),
    ]);

    const byPlatform = new Map<
      Marketplace,
      { sale: number; list: number }
    >();
    for (const l of listings) {
      const sale = Number(l.salePrice);
      const list = Number(l.listPrice);
      const prev = byPlatform.get(l.platform);
      if (!prev || sale < prev.sale) {
        byPlatform.set(l.platform, { sale, list });
      }
    }

    const buyBoxByPlatform = new Map<Marketplace, number>();
    const countByPlatform = new Map<Marketplace, number>();
    for (const c of compRows) {
      countByPlatform.set(c.platform, (countByPlatform.get(c.platform) ?? 0) + 1);
      if (c.isBuyBox) {
        const p = Number(c.price);
        const cur = buyBoxByPlatform.get(c.platform);
        if (cur === undefined || p < cur) {
          buyBoxByPlatform.set(c.platform, p);
        }
      }
    }

    const platforms = new Set<Marketplace>([
      ...byPlatform.keys(),
      ...countByPlatform.keys(),
    ]);

    const rows: PriceGapPlatformRow[] = [];
    for (const platform of platforms) {
      const ours = byPlatform.get(platform);
      const buyBox = buyBoxByPlatform.get(platform) ?? null;
      const ourSale = ours?.sale ?? null;
      let gapTry: number | null = null;
      let gapPct: number | null = null;
      if (ourSale != null && buyBox != null) {
        gapTry = Math.round((ourSale - buyBox) * 100) / 100;
        if (buyBox !== 0) {
          gapPct = Math.round(((ourSale - buyBox) / buyBox) * 10_000) / 100;
        }
      }
      rows.push({
        platform,
        ourSalePrice: ourSale,
        ourListPrice: ours?.list ?? null,
        buyBoxPrice: buyBox,
        gapTry,
        gapPct,
        competitorCount: countByPlatform.get(platform) ?? 0,
      });
    }
    rows.sort((a, b) => a.platform.localeCompare(b.platform));

    return { barcode, platforms: rows };
  }

  async getPriceTrend(
    organizationId: string,
    barcode: string,
    platform: Marketplace,
  ): Promise<PriceTrendPoint[]> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [snapshots, competitors] = await Promise.all([
      this.prisma.buyBoxSnapshot.findMany({
        where: { organizationId, barcode, platform, capturedAt: { gte: since } },
        orderBy: { capturedAt: 'asc' },
        select: { capturedAt: true, ourPrice: true, buyBoxPrice: true },
      }),
      this.prisma.competitorPrice.findMany({
        where: { organizationId, barcode, platform, capturedAt: { gte: since } },
        orderBy: { capturedAt: 'asc' },
        select: { capturedAt: true, price: true, isBuyBox: true },
      }),
    ]);

    const dayKeys: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dayKeys.push(this.formatIstanbulDateKey(d));
    }

    const ourByDay = new Map<string, number>();
    const bbByDay = new Map<string, number>();
    for (const s of snapshots) {
      const key = this.formatIstanbulDateKey(s.capturedAt);
      ourByDay.set(key, Number(s.ourPrice));
      bbByDay.set(key, Number(s.buyBoxPrice));
    }

    const compSum = new Map<string, { sum: number; n: number }>();
    for (const c of competitors) {
      if (c.isBuyBox) {
        continue;
      }
      const key = this.formatIstanbulDateKey(c.capturedAt);
      const cur = compSum.get(key) ?? { sum: 0, n: 0 };
      cur.sum += Number(c.price);
      cur.n += 1;
      compSum.set(key, cur);
    }

    return dayKeys.map((date) => {
      const agg = compSum.get(date);
      return {
        date,
        ourPrice: ourByDay.get(date) ?? null,
        buyBoxPrice: bbByDay.get(date) ?? null,
        avgCompetitorPrice:
          agg && agg.n > 0 ? Math.round((agg.sum / agg.n) * 100) / 100 : null,
      };
    });
  }

  private formatIstanbulDateKey(d: Date): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
}
