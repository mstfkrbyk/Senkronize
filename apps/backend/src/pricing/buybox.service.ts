import { Injectable } from '@nestjs/common';
import { Marketplace, Prisma, type BuyBoxSnapshot, type PriceHistory } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuyBoxService {
  constructor(private readonly prisma: PrismaService) {}

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
