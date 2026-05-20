import type { ProductSelection } from '@/lib/product-selection';

export type OnboardingWizardStepId =
  | 'company'
  | 'accounting'
  | 'erp'
  | 'marketplace'
  | 'connections-bundle'
  | 'product-plan'
  | 'complete';

export interface OnboardingStepMeta {
  id: OnboardingWizardStepId;
  label: string;
}

const STEP_LABELS: Record<OnboardingWizardStepId, string> = {
  company: 'Firma Bilgileri',
  accounting: 'Ön Muhasebe',
  erp: 'ERP Seçimi',
  marketplace: 'Pazaryerleri',
  'connections-bundle': 'Bağlantılar',
  'product-plan': 'Paket',
  complete: 'Tamamlandı',
};

export function buildOnboardingSteps(
  selection: ProductSelection | null,
): OnboardingStepMeta[] {
  const path = selection ?? 'BUNDLE';

  switch (path) {
    case 'ACCOUNTING':
      return [
        { id: 'company', label: STEP_LABELS.company },
        { id: 'accounting', label: STEP_LABELS.accounting },
        { id: 'product-plan', label: STEP_LABELS['product-plan'] },
        { id: 'complete', label: STEP_LABELS.complete },
      ];
    case 'INTEGRATION':
      return [
        { id: 'company', label: STEP_LABELS.company },
        { id: 'erp', label: STEP_LABELS.erp },
        { id: 'marketplace', label: STEP_LABELS.marketplace },
        { id: 'product-plan', label: STEP_LABELS['product-plan'] },
        { id: 'complete', label: STEP_LABELS.complete },
      ];
    case 'BUNDLE':
      return [
        { id: 'company', label: STEP_LABELS.company },
        { id: 'accounting', label: STEP_LABELS.accounting },
        { id: 'connections-bundle', label: STEP_LABELS['connections-bundle'] },
        { id: 'product-plan', label: STEP_LABELS['product-plan'] },
        { id: 'complete', label: STEP_LABELS.complete },
      ];
    default: {
      const _exhaustive: never = path;
      return _exhaustive;
    }
  }
}

export interface QuickStartItem {
  label: string;
  href: string;
}

export function quickStartItemsForSelection(
  selection: ProductSelection | null,
): readonly QuickStartItem[] {
  const path = selection ?? 'BUNDLE';

  switch (path) {
    case 'ACCOUNTING':
      return [
        { label: 'Ön muhasebe paneline git', href: '/accounting' },
        { label: 'Fatura oluştur', href: '/invoices' },
        { label: 'Muhasebe bağlantısı kur', href: '/connections' },
        { label: 'Ekip üyesi davet et', href: '/settings?tab=team' },
      ];
    case 'INTEGRATION':
      return [
        { label: 'İlk ürünü ekle', href: '/products' },
        { label: 'Pazaryeri bağla', href: '/connections' },
        { label: 'ERP kur', href: '/connections/erp/setup' },
        { label: 'Ekip üyesi davet et', href: '/settings?tab=team' },
      ];
    case 'BUNDLE':
      return [
        { label: 'Ön muhasebe özeti', href: '/accounting' },
        { label: 'Pazaryeri bağla', href: '/connections' },
        { label: 'ERP / muhasebe bağlantısı', href: '/connections' },
        { label: 'Ekip üyesi davet et', href: '/settings?tab=team' },
      ];
    default: {
      const _exhaustive: never = path;
      return _exhaustive;
    }
  }
}
