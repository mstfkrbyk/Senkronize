import type { OrgProductLine } from '@/types/auth';

export type ProductSelection = 'ACCOUNTING' | 'INTEGRATION' | 'BUNDLE';

export const PRODUCT_SELECTION_STORAGE_KEY = 'senkronize-product-selection';

export interface ProductSelectionOption {
  id: ProductSelection;
  title: string;
  description: string;
  features: readonly string[];
  recommended?: boolean;
  /** Paket kartı — fiyatlandırma sayfasıyla aynı indirim etiketi */
  discountLabel?: string;
}

/** Kayıt / onboarding ürün kartları — marketing `site-content` ile uyumlu */
export const PRODUCT_SELECTION_OPTIONS: readonly ProductSelectionOption[] = [
  {
    id: 'INTEGRATION',
    title: 'Entegrasyon',
    description: 'Pazaryeri, e-ticaret ve sipariş–stok senkronizasyonu.',
    features: [
      'Pazaryeri bağlantıları',
      'Sipariş ve iade akışı',
      'Gerçek zamanlı stok senkronu',
      'ERP köprüsü ve masaüstü ajan',
    ],
  },
  {
    id: 'ACCOUNTING',
    title: 'Ön Muhasebe',
    description: 'Yerel fatura, cari hesap ve KDV yönetimi — harici ERP zorunlu değil.',
    features: [
      'Fatura oluşturma ve numaralandırma',
      'Cari hesap ve ekstre',
      'KDV özeti ve raporlama',
      'BizimHesap, Paraşüt köprüsü',
    ],
  },
  {
    id: 'BUNDLE',
    title: 'Paket',
    description:
      'Ön Muhasebe ve Entegrasyon tek panelde; yıllık faturalamada iki hat birlikte alındığında indirim uygulanır.',
    features: ['Fatura ve cari', 'Pazaryeri ve sipariş', 'Tek panel ve raporlama'],
    discountLabel: '%20 indirimli',
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
