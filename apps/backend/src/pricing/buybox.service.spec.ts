import { Marketplace } from '@prisma/client';

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BuyBox kazanan hesaplama', () => {
    it('snapshot isWinner=true ise kazanan olarak işaretler', async () => {
      prisma.listing.findFirst = jest.fn().mockResolvedValue({
        id: 'listing-1',
        barcode: '8690001',
        platform: Marketplace.TRENDYOL,
        salePrice: 120,
        productId: 'prod-1',
        title: 'Test',
      });
      prisma.buyBoxSnapshot.findFirst = jest.fn().mockResolvedValue({
        isWinner: true,
        buyBoxPrice: 119,
        ourPrice: 118,
      });
      competitorPriceService.getLatestCompetitorPrices = jest
        .fn()
        .mockResolvedValue([
          { platform: Marketplace.TRENDYOL, price: 125, isBuyBox: false },
        ]);
      prisma.product.findFirst = jest.fn().mockResolvedValue({ costPrice: 80 });

      const status = await svc.detectBuyBoxWinner('org-1', 'listing-1');

      expect(status.isWinner).toBe(true);
      expect(status.recommendation).toBe('hold');
    });

    it('fiyat rakipten yüksekse lower önerir', async () => {
      prisma.listing.findFirst = jest.fn().mockResolvedValue({
        id: 'listing-2',
        barcode: '8690002',
        platform: Marketplace.TRENDYOL,
        salePrice: 150,
        productId: 'prod-2',
        title: 'Pahalı',
      });
      prisma.buyBoxSnapshot.findFirst = jest.fn().mockResolvedValue({
        isWinner: false,
        buyBoxPrice: 130,
        ourPrice: 150,
      });
      competitorPriceService.getLatestCompetitorPrices = jest
        .fn()
        .mockResolvedValue([
          { platform: Marketplace.TRENDYOL, price: 130, isBuyBox: true },
        ]);
      prisma.product.findFirst = jest.fn().mockResolvedValue({ costPrice: 90 });

      const status = await svc.detectBuyBoxWinner('org-1', 'listing-2');

      expect(status.isWinner).toBe(false);
      expect(status.recommendation).toBe('lower');
      expect(status.priceGap).toBeGreaterThan(0);
    });
  });

  describe('optimal fiyat algoritması', () => {
    it('en düşük rakip fiyattan %1 düşük fiyat önerir (balanced)', () => {
      const next = svc.calculateOptimalPrice({
        currentPrice: 200,
        costPrice: 50,
        minMargin: 10,
        competitors: [{ price: 100 }, { price: 110 }],
        strategy: 'balanced',
      });
      expect(next).toBe(99);
    });

    it('aggressive stratejide rakipten 0.01 TL düşük fiyat önerir', () => {
      const next = svc.calculateOptimalPrice({
        currentPrice: 200,
        costPrice: 50,
        minMargin: 10,
        competitors: [{ price: 100 }],
        strategy: 'aggressive',
      });
      expect(next).toBe(99.99);
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

    it('rakip minimum fiyatın altındaysa minimum fiyat döner', () => {
      const costPrice = 100;
      const minPrice = Math.round(costPrice * 1.1 * 100) / 100;
      const next = svc.calculateOptimalPrice({
        currentPrice: 200,
        costPrice,
        minMargin: 10,
        competitors: [{ price: 85 }],
        strategy: 'aggressive',
      });
      expect(next).toBe(minPrice);
    });

    it('conservative stratejide ortalama fiyata yakın hedefler', () => {
      const next = svc.calculateOptimalPrice({
        currentPrice: 200,
        costPrice: 50,
        minMargin: 10,
        competitors: [{ price: 100 }, { price: 120 }],
        strategy: 'conservative',
      });
      expect(next).toBe(107.8);
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
  });

  describe('rakip fiyat karşılaştırması', () => {
    it('en düşük rakip fiyatı doğru hesaplar', async () => {
      prisma.listing.findFirst = jest.fn().mockResolvedValue({
        id: 'listing-3',
        barcode: '8690003',
        platform: Marketplace.HEPSIBURADA,
        salePrice: 95,
        productId: null,
        title: 'HB Ürün',
      });
      prisma.buyBoxSnapshot.findFirst = jest.fn().mockResolvedValue(null);
      competitorPriceService.getLatestCompetitorPrices = jest
        .fn()
        .mockResolvedValue([
          { platform: Marketplace.HEPSIBURADA, price: 92, isBuyBox: false },
          { platform: Marketplace.HEPSIBURADA, price: 88, isBuyBox: false },
        ]);

      const status = await svc.detectBuyBoxWinner('org-1', 'listing-3');

      expect(status.lowestCompetitorPrice).toBe(88);
      expect(status.currentPrice).toBe(95);
    });

    it('stok 0 ise optimizasyon yapılmaz', () => {
      const engine = new PricingEngine();
      const currentPrice = 150;
      expect(engine.calculateStockBasedPrice(currentPrice, 0, 5)).toBe(
        currentPrice,
      );
    });
  });
});
