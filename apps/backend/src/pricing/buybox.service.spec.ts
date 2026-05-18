import { BuyBoxService } from './buybox.service';

describe('BuyBoxService', () => {
  const pricingEngine = {
    calculateOptimalPrice: jest.fn(),
    isRuleActiveNow: jest.fn(),
    ruleAppliesToListing: jest.fn(),
    calculateDemandBasedPrice: jest.fn(),
    calculateStockBasedPrice: jest.fn(),
  } as unknown as import('./pricing.engine').PricingEngine;

  const competitorPriceService = {
    getLatestCompetitorPrices: jest.fn(),
  } as unknown as import('./competitor-price.service').CompetitorPriceService;

  const prisma = {} as unknown as import('../prisma/prisma.service').PrismaService;

  it('calculateOptimalPrice: agresif strateji min marjı korur', () => {
    const svc = new BuyBoxService(prisma, pricingEngine, competitorPriceService);
    const next = svc.calculateOptimalPrice({
      currentPrice: 200,
      costPrice: 100,
      minMargin: 15,
      competitors: [{ price: 120 }, { price: 130 }],
      strategy: 'aggressive',
    });
    expect(next).toBeGreaterThanOrEqual(115);
    expect(next).toBeLessThanOrEqual(120);
  });
});
