import { Marketplace, Prisma, PricingStrategy, type PricingRule } from '@prisma/client';

import { PricingEngine } from '../pricing.engine';

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

  describe('calculateOptimalPrice', () => {
    it('FIXED_MARGIN stratejisi ile maliyet + marj uygulamalı', () => {
      const rule = makeRule({
        strategy: PricingStrategy.FIXED_MARGIN,
        costPrice: 100,
        minMarginPct: new Prisma.Decimal(20),
      });
      const next = engine.calculateOptimalPrice(rule, 200, 150, null);
      expect(next).toBe(120);
    });

    it('FIXED_MARGIN: maliyet yoksa null dönmeli', () => {
      const rule = makeRule({
        strategy: PricingStrategy.FIXED_MARGIN,
        costPrice: null,
        minMarginPct: new Prisma.Decimal(10),
      });
      expect(
        engine.calculateOptimalPrice(rule, 100, 90, null),
      ).toBeNull();
    });

    it('AGGRESSIVE_BUYBOX (rekabetçi) rakipten düşük fiyat üretmeli', () => {
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

    it('minimum fiyat sınırını (marj tabanı) aşmamalı', () => {
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

    it('PROFIT_FOCUSED: maksimum fiyat sınırını geçmemeli', () => {
      const rule = makeRule({
        strategy: PricingStrategy.PROFIT_FOCUSED,
        costPrice: 80,
        minMarginPct: new Prisma.Decimal(10),
        maxPrice: 101,
      });
      const next = engine.calculateOptimalPrice(rule, 100, 95, null, {
        stock: 50,
        hasBuyBox: true,
      });
      expect(next).not.toBeNull();
      expect(next!).toBeLessThanOrEqual(101);
    });

    it('PROFIT_FOCUSED: BuyBox kazanınca fiyatı kontrollü artırmalı', () => {
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
  });

  describe('isRuleActiveNow', () => {
    it('aktif kural (ek kısıt yok) için true döndürmeli', () => {
      const rule = makeRule({ strategy: PricingStrategy.MATCH_BUYBOX });
      expect(engine.isRuleActiveNow(rule, new Date('2026-05-18T12:00:00.000Z'))).toBe(
        true,
      );
    });

    it('zaman dilimi dışındaki kural için false döndürmeli', () => {
      const rule = makeRule({
        strategy: PricingStrategy.MATCH_BUYBOX,
        hoursStart: 9,
        hoursEnd: 17,
      });
      const night = new Date('2026-05-18T22:00:00.000Z');
      expect(engine.isRuleActiveNow(rule, night)).toBe(false);
    });

    it('tarih aralığı dışındaki kural için false döndürmeli', () => {
      const rule = makeRule({
        strategy: PricingStrategy.MATCH_BUYBOX,
        scheduledEnd: new Date('2020-01-01T00:00:00.000Z'),
      });
      expect(engine.isRuleActiveNow(rule, new Date('2026-05-18T12:00:00.000Z'))).toBe(
        false,
      );
    });

    it('gün filtresi dışındaysa false döndürmeli', () => {
      const rule = makeRule({
        strategy: PricingStrategy.MATCH_BUYBOX,
        daysOfWeek: [2],
      });
      const monday = new Date('2026-05-18T12:00:00.000Z');
      expect(engine.isRuleActiveNow(rule, monday)).toBe(false);
    });
  });

  describe('calculateDemandBasedPrice / calculateStockBasedPrice', () => {
    it('talep hızına göre fiyat kademeleri', () => {
      expect(engine.calculateDemandBasedPrice(100, 11)).toBe(105);
      expect(engine.calculateDemandBasedPrice(100, 6)).toBe(102);
      expect(engine.calculateDemandBasedPrice(100, 0.5)).toBe(97);
      expect(engine.calculateDemandBasedPrice(100, 3)).toBe(100);
    });

    it('stok eşiğine göre prim ve eritme', () => {
      expect(engine.calculateStockBasedPrice(100, 2, 5)).toBe(110);
      expect(engine.calculateStockBasedPrice(100, 20, 5)).toBe(95);
      expect(engine.calculateStockBasedPrice(100, 8, 5)).toBe(100);
    });
  });

  describe('ruleAppliesToListing', () => {
    it('kategori filtresine göre eşleşmeli', () => {
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
});
