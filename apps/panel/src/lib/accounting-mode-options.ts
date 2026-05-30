import type { AccountingMode } from '@/types/auth';

export interface AccountingModeOption {
  id: AccountingMode;
  title: string;
  description: string;
}

/** Kayıt ve onboarding — NATIVE (Senkronize) vs Harici ERP */
export const ACCOUNTING_MODE_OPTIONS: readonly AccountingModeOption[] = [
  {
    id: 'NATIVE',
    title: 'Senkronize ön muhasebe',
    description:
      'Fatura, cari hesap ve KDV işlemlerini Senkronize panelinde yönetin. Stok ve envanter bu modda ön muhasebe menüsünde yer alır.',
  },
  {
    id: 'EXTERNAL_ERP',
    title: 'Harici ERP / muhasebe programı',
    description:
      'Muhasebe ve fatura akışını Paraşüt, Bizim Hesap veya kurumsal ERP üzerinden yürütün. Senkronize sipariş ve pazaryeri operasyonlarına odaklanır.',
  },
] as const;
