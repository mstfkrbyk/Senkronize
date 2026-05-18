import { Marketplace, Prisma, PricingStrategy, type PricingRule } from '@prisma/client';

import { PricingEngine } from './pricing.engine';

function makeRule(
  overrides: Partial<PricingRule> & Pick<PricingRule, 'strategy'>,
): PricingRule {
  return {
    id: 'rule-id',
    organizationId: 'org-id',
    name: 'Test rule',
    platform: Marketplace.TRENDYOL,
    minMarginPct: new Prisma.Decimal(10),
    maxDiscountPct: new Prisma.Decimal(50),
    targetPosition: 1,
    costPrice: null,
    minMarginPercent: null,
    stepAmount: 0.01,
    nightDiscountPercent: null,
    peakPremiumPercent: null,
    lowStockThreshold: 5,
    highStockThreshold: 100,
    maxPrice: null,
    isActive: true,
    applyToAll: false,
    barcodes: [],
    scheduledStart: null,
    scheduledEnd: null,
    daysOfWeek: [],
    hoursStart: null,
    hoursEnd: null,
    categoryFilter: null,
    brandFilter: null,
    skuPattern: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('PricingEngine', () => {
  let engine: PricingEngine;

  beforeEach(() => {
    engine = new PricingEngine();
  });

  it('AGGRESSIVE_BUYBOX: competitor fiyatından düşük olmalı', () => {
    const rule = makeRule({
      strategy: PricingStrategy.AGGRESSIVE_BUYBOX,
      costPrice: 50,
      minMarginPct: new Prisma.Decimal(10),
      minMarginPercent: 0.1,
      stepAmount: 0.01,
    });

    const next = engine.calculateOptimalPrice(rule, 100, 100, null);

    expect(next).not.toBeNull();
    expect(next!).toBeLessThan(100);
  });

  it('AGGRESSIVE_BUYBOX: min kâr marjını korumalı', () => {
    const rule = makeRule({
      strategy: PricingStrategy.AGGRESSIVE_BUYBOX,
      costPrice: 50,
      minMarginPct: new Prisma.Decimal(10),
      minMarginPercent: 0.2,
      stepAmount: 0.01,
    });

    const next = engine.calculateOptimalPrice(rule, 100, 60, null);

    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThanOrEqual(60);
  });

  it('PROFIT_FOCUSED: BuyBox kazanınca fiyatı artırmalı', () => {
    const rule = makeRule({
      strategy: PricingStrategy.PROFIT_FOCUSED,
      costPrice: 80,
      minMarginPct: new Prisma.Decimal(10),
      maxPrice: 200,
    });

    const next = engine.calculateOptimalPrice(rule, 100, 95, null, {
      stock: 50,
      hasBuyBox: true,
    });

    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThan(100);
  });

  it('STOCK_BASED: düşük stokta fiyat artmalı', () => {
    const rule = makeRule({
      strategy: PricingStrategy.STOCK_BASED,
      costPrice: 40,
      minMarginPct: new Prisma.Decimal(10),
      lowStockThreshold: 5,
    });

    const base = engine.calculateOptimalPrice(rule, 100, 0, null, {
      stock: 100,
      hasBuyBox: false,
    });
    const low = engine.calculateOptimalPrice(rule, 100, 0, null, {
      stock: 2,
      hasBuyBox: false,
    });

    expect(base).not.toBeNull();
    expect(low).not.toBeNull();
    expect(low!).toBeGreaterThan(base!);
  });

  it('isRuleActiveNow: gün filtresi dışındaysa false', () => {
    const rule = makeRule({
      strategy: PricingStrategy.MATCH_BUYBOX,
      daysOfWeek: [2],
    });
    const monday = new Date('2026-05-18T12:00:00.000Z');
    expect(engine.isRuleActiveNow(rule, monday)).toBe(false);
  });

  it('ruleAppliesToListing: kategori filtresi', () => {
    const rule = makeRule({
      strategy: PricingStrategy.MATCH_BUYBOX,
      categoryFilter: 'Ayakkabı',
    });
    expect(
      engine.ruleAppliesToListing(rule, {
        barcode: 'x',
        product: { category: 'Spor Ayakkabı', brand: 'X', sku: 'SKU1' },
      }),
    ).toBe(true);
    expect(
      engine.ruleAppliesToListing(rule, {
        barcode: 'x',
        product: { category: 'Giyim', brand: 'X', sku: 'SKU1' },
      }),
    ).toBe(false);
  });
});
