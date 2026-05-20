import { BuyBoxService } from './buybox.service';
import { PricingEngine } from './pricing.engine';

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

  const svc = new BuyBoxService(prisma, pricingEngine, competitorPriceService);

  it('en düşük fiyatlı rakipten %1 düşük fiyat önerir', () => {
    const next = svc.calculateOptimalPrice({
      currentPrice: 200,
      costPrice: 50,
      minMargin: 10,
      competitors: [{ price: 100 }, { price: 110 }],
      strategy: 'balanced',
    });
    expect(next).toBe(99);
  });

  it('minimum marj korunur', () => {
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

  it('rakip yoksa mevcut fiyatı korur', () => {
    const next = svc.calculateOptimalPrice({
      currentPrice: 200,
      costPrice: 100,
      minMargin: 15,
      competitors: [],
      strategy: 'aggressive',
    });
    expect(next).toBe(200);
  });

  it('stok 0 ise optimizasyon yapılmaz', () => {
    const engine = new PricingEngine();
    expect(engine.calculateStockBasedPrice(150, 0, 5)).toBe(150);
  });
});
