import type { OrgProductLine } from '@/types/auth';

export type ProductSelection = 'ACCOUNTING' | 'INTEGRATION' | 'BUNDLE';

export const PRODUCT_SELECTION_STORAGE_KEY = 'senkronize-product-selection';

export interface ProductSelectionOption {
  id: ProductSelection;
  title: string;
  description: string;
  features: readonly string[];
  recommended?: boolean;
}

export const PRODUCT_SELECTION_OPTIONS: readonly ProductSelectionOption[] = [
  {
    id: 'ACCOUNTING',
    title: 'Sadece Ön Muhasebe',
    description: 'ERP satın almadan fatura, cari ve KDV yönetimi.',
    features: ['Fatura oluşturma', 'Cari hesap', 'KDV takibi'],
  },
  {
    id: 'INTEGRATION',
    title: 'Sadece Entegrasyon',
    description: 'Pazaryeri, sipariş ve stok senkronizasyonu.',
    features: ['Pazaryeri bağlantıları', 'Sipariş akışı', 'Stok senkronu'],
  },
  {
    id: 'BUNDLE',
    title: 'Paket',
    description: 'Ön muhasebe ve entegrasyon bir arada.',
    features: ['Fatura & cari', 'Pazaryeri & sipariş', 'Tek panel'],
    recommended: true,
  },
] as const;

export function isProductSelection(value: unknown): value is ProductSelection {
  return value === 'ACCOUNTING' || value === 'INTEGRATION' || value === 'BUNDLE';
}

export function readStoredProductSelection(): ProductSelection | null {
  try {
    const raw = localStorage.getItem(PRODUCT_SELECTION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return isProductSelection(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredProductSelection(value: ProductSelection): void {
  try {
    localStorage.setItem(PRODUCT_SELECTION_STORAGE_KEY, value);
  } catch {
    /* localStorage unavailable */
  }
}

export function clearStoredProductSelection(): void {
  try {
    localStorage.removeItem(PRODUCT_SELECTION_STORAGE_KEY);
  } catch {
    /* localStorage unavailable */
  }
}

/** Sunucudaki orgProducts → kayıt ürün seçimi. */
export function productSelectionFromOrgProducts(
  orgProducts: OrgProductLine[] | undefined,
): ProductSelection | null {
  if (!orgProducts?.length) {
    return null;
  }
  const hasAccounting = orgProducts.includes('ACCOUNTING');
  const hasIntegration = orgProducts.includes('INTEGRATION');
  if (hasAccounting && hasIntegration) {
    return 'BUNDLE';
  }
  if (hasAccounting) {
    return 'ACCOUNTING';
  }
  if (hasIntegration) {
    return 'INTEGRATION';
  }
  return null;
}

/** orgProducts öncelikli; yoksa localStorage. */
export function resolveOnboardingProductSelection(
  stored: ProductSelection | null,
  orgProducts: OrgProductLine[] | undefined,
): ProductSelection | null {
  const fromOrg = productSelectionFromOrgProducts(orgProducts);
  if (fromOrg) {
    return fromOrg;
  }
  return stored;
}
