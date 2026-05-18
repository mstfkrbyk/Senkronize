import { Marketplace } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CompetitorPriceService } from './competitor-price.service';

describe('CompetitorPriceService', () => {
  it('recordCompetitorPrices boş diziyle createMany çağırmaz', async () => {
    const prisma = {
      competitorPrice: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;
    const svc = new CompetitorPriceService(prisma);
    await svc.recordCompetitorPrices('org', '868', Marketplace.TRENDYOL, []);
    expect(prisma.competitorPrice.createMany).not.toHaveBeenCalled();
  });
});
