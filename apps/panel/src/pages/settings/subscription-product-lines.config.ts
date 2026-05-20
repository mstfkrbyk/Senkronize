import type { OrgProductLine } from '@/types/auth';

import { hasOrgProductLine } from '@/lib/org-products';
import { productSelectionFromOrgProducts } from '@/lib/product-selection';
import type { ProductSelection } from '@/lib/product-selection';

export type SubscriptionProductLineCardId = 'INTEGRATION' | 'ACCOUNTING' | 'BUNDLE';

export interface SubscriptionProductLineCardConfig {
  id: SubscriptionProductLineCardId;
  titleKey: string;
  descriptionKey: string;
  featureKeys: readonly string[];
  recommended?: boolean;
}

export const SUBSCRIPTION_PRODUCT_LINE_CARDS: readonly SubscriptionProductLineCardConfig[] =
  [
    {
      id: 'INTEGRATION',
      titleKey: 'settings.subscriptionTab.productLines.integration.title',
      descriptionKey: 'settings.subscriptionTab.productLines.integration.description',
      featureKeys: [
        'settings.subscriptionTab.productLines.integration.features.marketplaces',
        'settings.subscriptionTab.productLines.integration.features.orders',
        'settings.subscriptionTab.productLines.integration.features.stock',
      ],
    },
    {
      id: 'ACCOUNTING',
      titleKey: 'settings.subscriptionTab.productLines.accounting.title',
      descriptionKey: 'settings.subscriptionTab.productLines.accounting.description',
      featureKeys: [
        'settings.subscriptionTab.productLines.accounting.features.invoices',
        'settings.subscriptionTab.productLines.accounting.features.customers',
        'settings.subscriptionTab.productLines.accounting.features.vat',
      ],
    },
    {
      id: 'BUNDLE',
      titleKey: 'settings.subscriptionTab.productLines.bundle.title',
      descriptionKey: 'settings.subscriptionTab.productLines.bundle.description',
      featureKeys: [
        'settings.subscriptionTab.productLines.bundle.features.accounting',
        'settings.subscriptionTab.productLines.bundle.features.integration',
        'settings.subscriptionTab.productLines.bundle.features.unified',
      ],
      recommended: true,
    },
  ] as const;

export function resolveActiveProductSelection(
  orgProducts: OrgProductLine[] | undefined,
): ProductSelection | null {
  return productSelectionFromOrgProducts(orgProducts);
}

export function isProductLineCardActive(
  cardId: SubscriptionProductLineCardId,
  orgProducts: OrgProductLine[] | undefined,
): boolean {
  const selection = resolveActiveProductSelection(orgProducts);
  if (cardId === 'BUNDLE') {
    return selection === 'BUNDLE';
  }
  if (cardId === 'INTEGRATION') {
    return hasOrgProductLine(orgProducts, 'INTEGRATION');
  }
  return hasOrgProductLine(orgProducts, 'ACCOUNTING');
}

export function isProductLineCardPrimary(
  cardId: SubscriptionProductLineCardId,
  orgProducts: OrgProductLine[] | undefined,
): boolean {
  return resolveActiveProductSelection(orgProducts) === cardId;
}

export function canUpgradeToProductLineCard(
  cardId: SubscriptionProductLineCardId,
  orgProducts: OrgProductLine[] | undefined,
): boolean {
  if (resolveActiveProductSelection(orgProducts) === 'BUNDLE') {
    return false;
  }
  if (cardId === 'BUNDLE') {
    return true;
  }
  if (cardId === 'INTEGRATION') {
    return !hasOrgProductLine(orgProducts, 'INTEGRATION');
  }
  return !hasOrgProductLine(orgProducts, 'ACCOUNTING');
}

/** Kart CTA'sı için eklenecek ürün hatları (sıralı). */
export function productLinesToAddForCard(
  cardId: SubscriptionProductLineCardId,
  orgProducts: OrgProductLine[] | undefined,
): OrgProductLine[] {
  if (cardId === 'BUNDLE') {
    const missing: OrgProductLine[] = [];
    if (!hasOrgProductLine(orgProducts, 'INTEGRATION')) {
      missing.push('INTEGRATION');
    }
    if (!hasOrgProductLine(orgProducts, 'ACCOUNTING')) {
      missing.push('ACCOUNTING');
    }
    return missing;
  }
  if (cardId === 'INTEGRATION' && !hasOrgProductLine(orgProducts, 'INTEGRATION')) {
    return ['INTEGRATION'];
  }
  if (cardId === 'ACCOUNTING' && !hasOrgProductLine(orgProducts, 'ACCOUNTING')) {
    return ['ACCOUNTING'];
  }
  return [];
}
