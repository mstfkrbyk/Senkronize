import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  Building2,
  ClipboardList,
  FilePlus,
  FileText,
  UserCircle,
} from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';

import type { AccountingMode } from '@/lib/accounting-mode';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

export const ACCOUNTING_PALETTE_GROUP_HEADING = 'Ön Muhasebe';

export interface AccountingPaletteCommand {
  id: string;
  title: string;
  icon: LucideIcon;
  keywords: string[];
  action: () => void;
}

export function shouldShowAccountingPaletteCommands(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): boolean {
  return (
    hasOrgProductLine(orgProducts, 'ACCOUNTING') && accountingMode === 'NATIVE'
  );
}

/** Yerel ön muhasebe — orgProducts + NATIVE mod */
export function buildAccountingPaletteCommands(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
  navigate: NavigateFunction,
  onClose: () => void,
): AccountingPaletteCommand[] {
  if (!shouldShowAccountingPaletteCommands(orgProducts, accountingMode)) {
    return [];
  }

  const wrap =
    (fn: () => void) =>
    (): void => {
      onClose();
      fn();
    };

  return [
    {
      id: 'accounting-new-invoice',
      title: 'Yeni Fatura',
      icon: FilePlus,
      keywords: ['fatura', 'yeni', 'oluştur', 'invoice', 'manuel'],
      action: wrap(() => navigate('/invoices?create=manual')),
    },
    {
      id: 'accounting-invoices',
      title: 'Faturalar',
      icon: FileText,
      keywords: ['fatura', 'faturalar', 'invoice', 'liste'],
      action: wrap(() => navigate('/invoices')),
    },
    {
      id: 'accounting-customers',
      title: 'Cari',
      icon: UserCircle,
      keywords: ['cari', 'müşteri', 'customer', 'hesap'],
      action: wrap(() => navigate('/customers')),
    },
    {
      id: 'accounting-vat-report',
      title: 'KDV Raporu',
      icon: BarChart2,
      keywords: ['kdv', 'vergi', 'vat', 'rapor', 'beyan'],
      action: wrap(() => navigate('/reports?tab=tax')),
    },
    {
      id: 'accounting-suppliers',
      title: 'Tedarikçiler',
      icon: Building2,
      keywords: ['tedarikçi', 'tedarikçiler', 'supplier', 'tedarik'],
      action: wrap(() => navigate('/suppliers')),
    },
    {
      id: 'accounting-purchase-orders',
      title: 'Satın Alma Siparişleri',
      icon: ClipboardList,
      keywords: [
        'satın alma',
        'sipariş',
        'purchase',
        'po',
        'tedarik',
        'satınalma',
      ],
      action: wrap(() => navigate('/purchase-orders')),
    },
  ];
}
