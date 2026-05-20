import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CompetitorPriceService } from './competitor-price.service';

export type PriceSource = 'manual' | 'rule' | 'campaign' | 'sync';

export interface RecordPriceChangeInput {
  organizationId: string;
  listingId: string;
  barcode: string;
  platform: Marketplace;
  oldPrice: Prisma.Decimal | number | string;
  newPrice: Prisma.Decimal | number | string;
  source: PriceSource;
  pricingRuleId?: string | null;
  reason?: string | null;
}

export interface ListingPriceHistoryItem {
  id: string;
  price: string;
  previousPrice: string | null;
  changePct: number | null;
  source: string;
  reason: string | null;
  appliedAt: string;
}

export interface PriceHistoryChartPoint {
  date: string;
  ourPrice: number | null;
  lowestCompetitor: number | null;
  avgCompetitor: number | null;
}

export interface ListingPriceHistoryResult {
  listingId: string;
  barcode: string;
  platform: Marketplace;
  title: string;
  currentPrice: string;
  items: ListingPriceHistoryItem[];
  chart: PriceHistoryChartPoint[];
}

export interface CompetitorMatrixRow {
  barcode: string;
  title: string;
  platforms: Array<{
    platform: Marketplace;
    listingId: string;
    ourPrice: number;
    lowestCompetitor: number | null;
    isCheapest: boolean;
  }>;
  globalLowest: number | null;
}

export interface TriggeredPriceAlert {
  alertId: string;
  listingId: string;
  barcode: string;
  platform: Marketplace;
  title: string;
  currentPrice: string;
  thresholdPrice: string;
  gapTry: number;
  notifyEmail: boolean;
  notifyInApp: boolean;
  notifySms: boolean;
}

export interface CreatePriceAlertInput {
  listingId: string;
  thresholdPrice: number;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  notifySms?: boolean;
}

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class PriceHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly competitorPriceService: CompetitorPriceService,
  ) {}

  async recordPriceChange(
    input: RecordPriceChangeInput,
    tx?: PrismaTx,
  ): Promise<void> {
    const oldNum = Number(input.oldPrice);
    const newNum = Number(input.newPrice);
    if (Number.isNaN(oldNum) || Number.isNaN(newNum)) {
      throw new BadRequestException('Geçersiz fiyat değeri');
    }
    if (Math.abs(oldNum - newNum) < 0.005) {
      return;
    }

    const client = tx ?? this.prisma;
    await client.priceHistory.create({
      data: {
        organizationId: input.organizationId,
        listingId: input.listingId,
        barcode: input.barcode,
        platform: input.platform,
        pricingRuleId: input.pricingRuleId ?? null,
        oldPrice: new Prisma.Decimal(oldNum),
        newPrice: new Prisma.Decimal(newNum),
        source: input.source,
        reason: input.reason ?? input.source,
      },
    });
  }

  async getListingPriceHistory(
    organizationId: string,
    listingId: string,
    days = 30,
  ): Promise<ListingPriceHistoryResult> {
    const clampedDays = Math.min(Math.max(days, 1), 365);
    const since = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000);

    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId, deletedAt: null },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }

    const [historyRows, snapshots, competitors] = await Promise.all([
      this.prisma.priceHistory.findMany({
        where: {
          organizationId,
          listingId,
          appliedAt: { gte: since },
        },
        orderBy: { appliedAt: 'desc' },
      }),
      this.prisma.buyBoxSnapshot.findMany({
        where: {
          organizationId,
          barcode: listing.barcode,
          platform: listing.platform,
          capturedAt: { gte: since },
        },
        orderBy: { capturedAt: 'asc' },
        select: {
          capturedAt: true,
          ourPrice: true,
          buyBoxPrice: true,
        },
      }),
      this.prisma.competitorPrice.findMany({
        where: {
          organizationId,
          barcode: listing.barcode,
          platform: listing.platform,
          capturedAt: { gte: since },
        },
        orderBy: { capturedAt: 'asc' },
        select: { capturedAt: true, price: true, isBuyBox: true },
      }),
    ]);

    const items: ListingPriceHistoryItem[] = historyRows.map((row) => {
      const oldP = Number(row.oldPrice);
      const newP = Number(row.newPrice);
      let changePct: number | null = null;
      if (oldP > 0 && !Number.isNaN(oldP) && !Number.isNaN(newP)) {
        changePct = Math.round(((newP - oldP) / oldP) * 10_000) / 100;
      }
      return {
        id: row.id,
        price: row.newPrice.toString(),
        previousPrice: row.oldPrice.toString(),
        changePct,
        source: row.source,
        reason: row.reason,
        appliedAt: row.appliedAt.toISOString(),
      };
    });

    const chart = this.buildChartSeries(since, clampedDays, {
      historyRows,
      snapshots,
      competitors,
      currentPrice: Number(listing.salePrice),
    });

    return {
      listingId: listing.id,
      barcode: listing.barcode,
      platform: listing.platform,
      title: listing.title,
      currentPrice: listing.salePrice.toString(),
      items,
      chart,
    };
  }

  async getCompetitorMatrix(
    organizationId: string,
  ): Promise<CompetitorMatrixRow[]> {
    const listings = await this.prisma.listing.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        barcode: true,
        title: true,
        platform: true,
        salePrice: true,
      },
      orderBy: { title: 'asc' },
      take: 200,
    });

    const barcodes = [...new Set(listings.map((l) => l.barcode))];
    const competitorMap = new Map<string, Map<Marketplace, number>>();

    await Promise.all(
      barcodes.map(async (barcode) => {
        const rows =
          await this.competitorPriceService.getLatestCompetitorPrices(
            organizationId,
            barcode,
          );
        const byPlatform = new Map<Marketplace, number>();
        for (const row of rows) {
          const p = Number(row.price);
          const cur = byPlatform.get(row.platform);
          if (cur === undefined || p < cur) {
            byPlatform.set(row.platform, p);
          }
        }
        competitorMap.set(barcode, byPlatform);
      }),
    );

    const byBarcode = new Map<string, typeof listings>();
    for (const listing of listings) {
      const group = byBarcode.get(listing.barcode) ?? [];
      group.push(listing);
      byBarcode.set(listing.barcode, group);
    }

    const matrix: CompetitorMatrixRow[] = [];
    for (const [barcode, group] of byBarcode) {
      const compByPlatform = competitorMap.get(barcode) ?? new Map();
      const platformRows = group.map((l) => {
        const ourPrice = Number(l.salePrice);
        const lowestCompetitor = compByPlatform.get(l.platform) ?? null;
        return {
          platform: l.platform,
          listingId: l.id,
          ourPrice,
          lowestCompetitor,
          isCheapest:
            lowestCompetitor != null ? ourPrice <= lowestCompetitor : false,
        };
      });

      const allPrices = platformRows.flatMap((r) => {
        const prices: number[] = [r.ourPrice];
        if (r.lowestCompetitor != null) {
          prices.push(r.lowestCompetitor);
        }
        return prices;
      });
      const globalLowest =
        allPrices.length > 0 ? Math.min(...allPrices) : null;

      matrix.push({
        barcode,
        title: group[0]?.title ?? barcode,
        platforms: platformRows,
        globalLowest,
      });
    }

    return matrix;
  }

  async getTriggeredAlerts(
    organizationId: string,
  ): Promise<TriggeredPriceAlert[]> {
    const alerts = await this.prisma.priceAlert.findMany({
      where: { organizationId, isActive: true },
      include: {
        listing: {
          select: {
            id: true,
            barcode: true,
            platform: true,
            title: true,
            salePrice: true,
            deletedAt: true,
          },
        },
      },
    });

    const triggered: TriggeredPriceAlert[] = [];
    for (const alert of alerts) {
      if (alert.listing.deletedAt != null) {
        continue;
      }
      const current = Number(alert.listing.salePrice);
      const threshold = Number(alert.thresholdPrice);
      if (current >= threshold) {
        continue;
      }
      triggered.push({
        alertId: alert.id,
        listingId: alert.listingId,
        barcode: alert.listing.barcode,
        platform: alert.listing.platform,
        title: alert.listing.title,
        currentPrice: alert.listing.salePrice.toString(),
        thresholdPrice: alert.thresholdPrice.toString(),
        gapTry: Math.round((threshold - current) * 100) / 100,
        notifyEmail: alert.notifyEmail,
        notifyInApp: alert.notifyInApp,
        notifySms: alert.notifySms,
      });
    }

    return triggered.sort((a, b) => b.gapTry - a.gapTry);
  }

  async createPriceAlert(
    organizationId: string,
    input: CreatePriceAlertInput,
  ): Promise<{ id: string }> {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: input.listingId,
        organizationId,
        deletedAt: null,
      },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }
    if (input.thresholdPrice <= 0) {
      throw new BadRequestException('Eşik fiyat sıfırdan büyük olmalıdır');
    }

    const alert = await this.prisma.priceAlert.create({
      data: {
        organizationId,
        listingId: input.listingId,
        thresholdPrice: new Prisma.Decimal(input.thresholdPrice),
        notifyEmail: input.notifyEmail ?? true,
        notifyInApp: input.notifyInApp ?? true,
        notifySms: input.notifySms ?? false,
      },
    });

    return { id: alert.id };
  }

  async listPriceAlerts(organizationId: string): Promise<
    Array<{
      id: string;
      listingId: string;
      barcode: string;
      platform: Marketplace;
      title: string;
      thresholdPrice: string;
      currentPrice: string;
      isTriggered: boolean;
      notifyEmail: boolean;
      notifyInApp: boolean;
      notifySms: boolean;
      createdAt: string;
    }>
  > {
    const rows = await this.prisma.priceAlert.findMany({
      where: { organizationId, isActive: true },
      include: {
        listing: {
          select: {
            barcode: true,
            platform: true,
            title: true,
            salePrice: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows
      .filter((r) => r.listing.deletedAt == null)
      .map((r) => {
        const current = Number(r.listing.salePrice);
        const threshold = Number(r.thresholdPrice);
        return {
          id: r.id,
          listingId: r.listingId,
          barcode: r.listing.barcode,
          platform: r.listing.platform,
          title: r.listing.title,
          thresholdPrice: r.thresholdPrice.toString(),
          currentPrice: r.listing.salePrice.toString(),
          isTriggered: current < threshold,
          notifyEmail: r.notifyEmail,
          notifyInApp: r.notifyInApp,
          notifySms: r.notifySms,
          createdAt: r.createdAt.toISOString(),
        };
      });
  }

  private buildChartSeries(
    since: Date,
    days: number,
    data: {
      historyRows: Array<{ appliedAt: Date; newPrice: Prisma.Decimal }>;
      snapshots: Array<{
        capturedAt: Date;
        ourPrice: Prisma.Decimal;
        buyBoxPrice: Prisma.Decimal;
      }>;
      competitors: Array<{
        capturedAt: Date;
        price: Prisma.Decimal;
        isBuyBox: boolean;
      }>;
      currentPrice: number;
    },
  ): PriceHistoryChartPoint[] {
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      if (d >= since) {
        dayKeys.push(this.formatIstanbulDateKey(d));
      }
    }

    const ourByDay = new Map<string, number>();
    for (const h of data.historyRows) {
      ourByDay.set(this.formatIstanbulDateKey(h.appliedAt), Number(h.newPrice));
    }
    for (const s of data.snapshots) {
      ourByDay.set(this.formatIstanbulDateKey(s.capturedAt), Number(s.ourPrice));
    }
    if (dayKeys.length > 0) {
      const lastKey = dayKeys[dayKeys.length - 1];
      if (lastKey) {
        ourByDay.set(lastKey, data.currentPrice);
      }
    }

    const lowestByDay = new Map<string, number>();
    const compAgg = new Map<string, { sum: number; n: number }>();

    for (const s of data.snapshots) {
      const key = this.formatIstanbulDateKey(s.capturedAt);
      lowestByDay.set(key, Number(s.buyBoxPrice));
    }
    for (const c of data.competitors) {
      const key = this.formatIstanbulDateKey(c.capturedAt);
      const price = Number(c.price);
      const curLow = lowestByDay.get(key);
      if (curLow === undefined || price < curLow) {
        lowestByDay.set(key, price);
      }
      const agg = compAgg.get(key) ?? { sum: 0, n: 0 };
      agg.sum += price;
      agg.n += 1;
      compAgg.set(key, agg);
    }

    return dayKeys.map((date) => {
      const agg = compAgg.get(date);
      return {
        date,
        ourPrice: ourByDay.get(date) ?? null,
        lowestCompetitor: lowestByDay.get(date) ?? null,
        avgCompetitor:
          agg && agg.n > 0
            ? Math.round((agg.sum / agg.n) * 100) / 100
            : null,
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
