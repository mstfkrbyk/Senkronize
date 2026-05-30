import type { AccountingMode } from '@/types/auth';

/** Admin müşteri listesi ve CSV — kısa mod etiketleri */
export const ADMIN_ACCOUNTING_MODE_LABEL: Record<AccountingMode, string> = {
  NATIVE: 'Ön muhasebe',
  EXTERNAL_ERP: 'Harici ERP',
};

export function adminAccountingModeBadgeClass(mode: AccountingMode): string {
  if (mode === 'NATIVE') {
    return 'border-sky-200 bg-sky-50 text-sky-900';
  }
  return 'border-violet-200 bg-violet-50 text-violet-900';
}
