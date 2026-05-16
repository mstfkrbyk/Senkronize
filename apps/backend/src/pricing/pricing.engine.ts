import { Injectable, Logger } from '@nestjs/common';
import type { PricingRule } from '@prisma/client';
import { PricingStrategy } from '@prisma/client';

@Injectable()
export class PricingEngine {
  private readonly logger = new Logger(PricingEngine.name);

  calculateOptimalPrice(
    rule: PricingRule,
    currentOurPrice: number,
    buyBoxPrice: number,
    costPrice: number | null,
  ): number | null {
    const minMarginPct = Number(rule.minMarginPct);
    const maxDiscountPct = Number(rule.maxDiscountPct);

    const minPrice = costPrice
      ? costPrice * (1 + minMarginPct / 100)
      : currentOurPrice * 0.8;

    let targetPrice: number;

    switch (rule.strategy) {
      case PricingStrategy.MATCH_BUYBOX:
        targetPrice = buyBoxPrice;
        break;

      case PricingStrategy.BEAT_BUYBOX:
        targetPrice = Math.min(buyBoxPrice - 1, buyBoxPrice * 0.99);
        break;

      case PricingStrategy.FIXED_MARGIN:
        if (!costPrice) {
          return null;
        }
        targetPrice = costPrice * (1 + minMarginPct / 100);
        break;

      case PricingStrategy.DYNAMIC:
        targetPrice = buyBoxPrice * 0.99;
        break;

      default:
        this.logger.warn('Bilinmeyen fiyatlandırma stratejisi', {
          strategy: rule.strategy,
        });
        return null;
    }

    const maxDiscountFloor = currentOurPrice * (1 - maxDiscountPct / 100);
    targetPrice = Math.max(targetPrice, minPrice, maxDiscountFloor);

    return Math.round(targetPrice * 100) / 100;
  }

  shouldUpdatePrice(
    currentPrice: number,
    newPrice: number,
    threshold = 0.01,
  ): boolean {
    if (currentPrice <= 0) {
      return newPrice > 0;
    }
    return Math.abs(currentPrice - newPrice) / currentPrice > threshold;
  }
}
