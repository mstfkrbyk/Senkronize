import {
  shouldPlaceStockInNativeAccounting,
  type NavCatalogContext,
} from '@/lib/nav-match';
import type { AccountingMode, OrgProductLine } from '@/types/auth';

export interface OnboardingTourStep {
  target: string;
  content: string;
  /** Hedef görünür değilse gidilecek rota */
  route?: string;
}

const BASE_TOUR_STEPS: readonly OnboardingTourStep[] = [
  {
    target: '[data-tour="sidebar-connections"]',
    content: 'Pazaryeri ve ERP bağlantılarınızı buradan ekleyin',
    route: '/connections',
  },
  {
    target: '[data-tour="sidebar-products"]',
    content: 'Ürün kataloğunuzu buradan yönetin',
    route: '/products',
  },
  {
    target: '[data-tour="sidebar-orders"]',
    content: 'Tüm kanallardan gelen siparişleri tek ekranda görün',
    route: '/orders',
  },
  {
    target: '[data-tour="sidebar-pricing"]',
    content: 'BuyBox optimizasyonu ve fiyat kurallarını buradan ayarlayın',
    route: '/pricing',
  },
  {
    target: '[data-tour="dashboard-sync"]',
    content: 'Anlık senkronizasyon durumunuzu buradan takip edin',
    route: '/dashboard',
  },
] as const;

const NATIVE_STOCK_TOUR_STEP: OnboardingTourStep = {
  target: '[data-tour="sidebar-stock"]',
  content:
    'Stok ve envanteri «Ön Muhasebe» grubundaki Stok menüsünden yönetin',
  route: '/products?tab=status',
};

/** @deprecated Tur adımları için `resolveOnboardingTourSteps` kullanın */
export const ONBOARDING_TOUR_STEPS: readonly OnboardingTourStep[] =
  BASE_TOUR_STEPS;

export function resolveOnboardingTourSteps(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): readonly OnboardingTourStep[] {
  const ctx: NavCatalogContext = { orgProducts, accountingMode };
  if (!shouldPlaceStockInNativeAccounting(ctx)) {
    return BASE_TOUR_STEPS;
  }
  return BASE_TOUR_STEPS.map((step, index) =>
    index === 1 ? NATIVE_STOCK_TOUR_STEP : step,
  );
}
