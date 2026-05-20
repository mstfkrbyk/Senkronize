import { PrismaService } from '../prisma/prisma.service';

import { BuyBoxService } from './buybox.service';
import { CompetitorPriceService } from './competitor-price.service';
import { PricingEngine } from './pricing.engine';

describe('BuyBoxService', () => {
  const prisma = {
    buyBoxSnapshot: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    listing: { findFirst: jest.fn(), findMany: jest.fn() },
    product: { findFirst: jest.fn() },
    pricingRule: { findMany: jest.fn() },
    priceHistory: { findMany: jest.fn() },
    orderItem: { aggregate: jest.fn() },
  } as unknown as PrismaService;

  const pricingEngine = {
    calculateOptimalPrice: jest.fn(),
    isRuleActiveNow: jest.fn(),
    ruleAppliesToListing: jest.fn(),
    calculateDemandBasedPrice: jest.fn(),
    calculateStockBasedPrice: jest.fn(),
  } as unknown as PricingEngine;

  const competitorPriceService = {
    getLatestCompetitorPrices: jest.fn(),
  } as unknown as CompetitorPriceService;

  const svc = new BuyBoxService(prisma, pricingEngine, competitorPriceService);

  it('en düşük rakip fiyattan %1 düşük fiyat önerir', () => {
    const next = svc.calculateOptimalPrice({
      currentPrice: 200,
      costPrice: 50,
      minMargin: 10,
      competitors: [{ price: 100 }, { price: 110 }],
      strategy: 'balanced',
    });
    expect(next).toBe(99);
  });

  it('minimum marj korunur (maliyet * 1.1)', () => {
    const costPrice = 100;
    const next = svc.calculateOptimalPrice({
      currentPrice: 200,
      costPrice,
      minMargin: 10,
      competitors: [{ price: 105 }],
      strategy: 'aggressive',
    });
    expect(next).toBeGreaterThanOrEqual(Math.round(costPrice * 1.1 * 100) / 100);
  });

  it('rakip yoksa mevcut fiyatı korur', () => {
    const currentPrice = 200;
    const next = svc.calculateOptimalPrice({
      currentPrice,
      costPrice: 100,
      minMargin: 15,
      competitors: [],
      strategy: 'aggressive',
    });
    expect(next).toBe(currentPrice);
  });

  it('stok 0 ise optimizasyon yapılmaz', () => {
    const engine = new PricingEngine();
    const currentPrice = 150;
    expect(engine.calculateStockBasedPrice(currentPrice, 0, 5)).toBe(
      currentPrice,
    );
  });
});
