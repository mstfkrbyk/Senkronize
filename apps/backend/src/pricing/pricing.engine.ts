import { Injectable, Logger } from '@nestjs/common';
import type { Listing, PricingRule, Product } from '@prisma/client';
import { PricingStrategy } from '@prisma/client';

const ISTANBUL_TZ = 'Europe/Istanbul';
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Listing + ürün alanları (kural filtreleri için) */
export type PricingListingFilterInput = Pick<Listing, 'barcode'> & {
  product: Pick<Product, 'category' | 'brand' | 'sku'> | null;
};

function istanbulWeekdayIndex0Sun(reference: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: ISTANBUL_TZ,
    weekday: 'short',
  }).format(reference);
  const idx = WEEKDAY_SHORT.indexOf(weekday as (typeof WEEKDAY_SHORT)[number]);
  return idx >= 0 ? idx : 0;
}

function istanbulHour0To23(reference: Date): number {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISTANBUL_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(reference);
  const hour = Number.parseInt(hourStr, 10);
  return Number.isFinite(hour) ? hour : 0;
}

function hourInRange(
  hour: number,
  start: number,
  end: number,
): boolean {
  if (start === end) {
    return true;
  }
  if (start < end) {
    return hour >= start && hour <= end;
  }
  return hour >= start || hour <= end;
}

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
  const hour = istanbulHour0To23(new Date());
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

function normalizeContainsFilter(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const t = value.trim();
  return t.length > 0 ? t.toLowerCase() : null;
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

  /** Kuralın şu an (İstanbul saati) aktif olup olmadığı */
  isRuleActiveNow(rule: PricingRule, reference: Date = new Date()): boolean {
    if (rule.scheduledStart != null && reference < rule.scheduledStart) {
      return false;
    }
    if (rule.scheduledEnd != null && reference > rule.scheduledEnd) {
      return false;
    }

    const days = rule.daysOfWeek ?? [];
    if (days.length > 0) {
      const dow = istanbulWeekdayIndex0Sun(reference);
      if (!days.includes(dow)) {
        return false;
      }
    }

    if (rule.hoursStart != null && rule.hoursEnd != null) {
      const hour = istanbulHour0To23(reference);
      if (
        !hourInRange(hour, rule.hoursStart, rule.hoursEnd)
      ) {
        return false;
      }
    }

    return true;
  }

  /** Kategori, marka ve SKU deseni eşleşmesi */
  ruleAppliesToListing(
    rule: PricingRule,
    listing: PricingListingFilterInput,
  ): boolean {
    const catFilter = normalizeContainsFilter(rule.categoryFilter);
    const brandFilter = normalizeContainsFilter(rule.brandFilter);
    const skuPattern = rule.skuPattern?.trim() ?? null;

    const product = listing.product;
    const category = product?.category?.trim().toLowerCase() ?? '';
    const brand = product?.brand?.trim().toLowerCase() ?? '';
    const sku = (product?.sku?.trim() ?? '').toLowerCase();
    const barcode = listing.barcode.trim().toLowerCase();

    if (catFilter !== null) {
      if (!category.includes(catFilter)) {
        return false;
      }
    }
    if (brandFilter !== null) {
      if (!brand.includes(brandFilter)) {
        return false;
      }
    }
    if (skuPattern !== null && skuPattern.length > 0) {
      try {
        const re = new RegExp(skuPattern, 'i');
        const haystack = sku.length > 0 ? sku : barcode;
        if (!re.test(haystack)) {
          return false;
        }
      } catch {
        this.logger.warn('Geçersiz skuPattern; kural atlanıyor', { ruleId: rule.id });
        return false;
      }
    }

    return true;
  }

  calculateOptimalPrice(
    rule: PricingRule,
    currentOurPrice: number,
    buyBoxPrice: number,
    costPriceOverride: number | null,
    context?: PricingEngineContext,
  ): number | null {
    if (!this.isRuleActiveNow(rule)) {
      return null;
    }

    const minMarginPct = Number(rule.minMarginPct);
    const maxDiscountPct = Number(rule.maxDiscountPct);

    const resolvedCost =
      rule.costPrice != null && !Number.isNaN(rule.costPrice)
        ? rule.costPrice
        : (costPriceOverride ?? 0);

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

    const minPriceFromLegacyMargin = resolvedCost
      ? resolvedCost * (1 + minMarginPct / 100)
      : currentOurPrice * 0.8;

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

  hasScheduleConfiguration(rule: PricingRule): boolean {
    return (
      rule.scheduledStart != null ||
      rule.scheduledEnd != null ||
      (rule.daysOfWeek?.length ?? 0) > 0 ||
      rule.hoursStart != null ||
      rule.hoursEnd != null
    );
  }
}
