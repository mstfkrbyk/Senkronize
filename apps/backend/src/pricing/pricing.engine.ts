import { Injectable, Logger } from '@nestjs/common';
import type { PricingRule } from '@prisma/client';
import { PricingStrategy } from '@prisma/client';

/** Rakibin fiyatından bir adım düşük, minimum kâr marjını korur */
function aggressiveBuyBox(
  currentPrice: number,
  competitorPrice: number,
  rule: PricingRule,
  resolvedCost: number,
): number {
  if (!competitorPrice || competitorPrice <= 0) {
    return currentPrice;
  }
  const step = rule.stepAmount ?? 0.01;
  const targetPrice = competitorPrice - step;
  const marginFrac = marginFraction(rule);
  const minPrice =
    resolvedCost > 0 ? resolvedCost * (1 + marginFrac) : currentPrice * 0.85;
  return Math.max(targetPrice, minPrice);
}

/** BuyBox yoksa minimum marjda tut; BuyBox'taysa yavaşça artır */
function profitFocused(
  currentPrice: number,
  hasBuyBox: boolean,
  rule: PricingRule,
  resolvedCost: number,
): number {
  const marginFrac = Math.max(marginFraction(rule), 0.1);
  const minFromCost =
    resolvedCost > 0 ? resolvedCost * (1 + marginFrac) : currentPrice * 0.95;
  const maxPrice = rule.maxPrice ?? currentPrice * 1.5;
  if (hasBuyBox) {
    return Math.min(currentPrice * 1.01, maxPrice);
  }
  return Math.max(minFromCost, currentPrice * 0.99);
}

/** Gece 00–06 indirim; öğle 12–14 peak prim */
function timeBased(basePrice: number, rule: PricingRule): number {
  const hour = new Date().getHours();
  const night = rule.nightDiscountPercent ?? 0.05;
  const peak = rule.peakPremiumPercent ?? 0.03;
  if (hour >= 0 && hour < 6) {
    return basePrice * (1 - night);
  }
  if (hour >= 12 && hour < 14) {
    return basePrice * (1 + peak);
  }
  return basePrice;
}

/** Stok azaldıkça fiyat artar */
function stockBased(basePrice: number, stock: number, rule: PricingRule): number {
  if (stock <= 0) {
    return rule.maxPrice ?? basePrice * 2;
  }
  const low = rule.lowStockThreshold ?? 5;
  const high = rule.highStockThreshold ?? 100;
  if (stock <= low) {
    return basePrice * 1.1;
  }
  if (stock >= high) {
    return basePrice * 0.95;
  }
  return basePrice;
}

function marginFraction(rule: PricingRule): number {
  if (rule.minMarginPercent != null && !Number.isNaN(rule.minMarginPercent)) {
    return rule.minMarginPercent;
  }
  return Number(rule.minMarginPct) / 100;
}

export interface PricingEngineContext {
  /** Listing stok adedi */
  stock: number;
  /** Son BuyBox anlık görüntüsünde kazanan mıyız */
  hasBuyBox: boolean;
}

@Injectable()
export class PricingEngine {
  private readonly logger = new Logger(PricingEngine.name);

  calculateOptimalPrice(
    rule: PricingRule,
    currentOurPrice: number,
    buyBoxPrice: number,
    costPriceOverride: number | null,
    context?: PricingEngineContext,
  ): number | null {
    const minMarginPct = Number(rule.minMarginPct);
    const maxDiscountPct = Number(rule.maxDiscountPct);

    const resolvedCost =
      rule.costPrice != null && !Number.isNaN(rule.costPrice)
        ? rule.costPrice
        : (costPriceOverride ?? 0);

    const minPriceFromLegacyMargin = resolvedCost
      ? resolvedCost * (1 + minMarginPct / 100)
      : currentOurPrice * 0.8;

    const stock = context?.stock ?? 0;
    const hasBuyBox = context?.hasBuyBox ?? false;

    let targetPrice: number;

    switch (rule.strategy) {
      case PricingStrategy.MATCH_BUYBOX:
        targetPrice = buyBoxPrice;
        break;

      case PricingStrategy.BEAT_BUYBOX:
        targetPrice = Math.min(buyBoxPrice - 1, buyBoxPrice * 0.99);
        break;

      case PricingStrategy.FIXED_MARGIN:
        if (!resolvedCost) {
          return null;
        }
        targetPrice = resolvedCost * (1 + minMarginPct / 100);
        break;

      case PricingStrategy.DYNAMIC:
        targetPrice = buyBoxPrice * 0.99;
        break;

      case PricingStrategy.AGGRESSIVE_BUYBOX:
        targetPrice = aggressiveBuyBox(
          currentOurPrice,
          buyBoxPrice,
          rule,
          resolvedCost,
        );
        break;

      case PricingStrategy.PROFIT_FOCUSED:
        targetPrice = profitFocused(currentOurPrice, hasBuyBox, rule, resolvedCost);
        break;

      case PricingStrategy.TIME_BASED: {
        const base =
          buyBoxPrice > 0
            ? Math.min(currentOurPrice, buyBoxPrice * 0.995)
            : currentOurPrice;
        targetPrice = timeBased(base, rule);
        break;
      }

      case PricingStrategy.STOCK_BASED: {
        const base =
          buyBoxPrice > 0
            ? Math.min(currentOurPrice, buyBoxPrice * 0.995)
            : currentOurPrice;
        targetPrice = stockBased(base, stock, rule);
        break;
      }

      default:
        this.logger.warn('Bilinmeyen fiyatlandırma stratejisi', {
          strategy: rule.strategy,
        });
        return null;
    }

    const maxDiscountFloor = currentOurPrice * (1 - maxDiscountPct / 100);
    targetPrice = Math.max(targetPrice, minPriceFromLegacyMargin, maxDiscountFloor);

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
