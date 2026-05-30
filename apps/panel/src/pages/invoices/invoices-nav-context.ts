import { NAV_GROUP_LABEL_KEYS } from '@/lib/nav-match';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { hasOrgProductLine } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

/** Fatura listesi / detay / oluştur ekranları için sayfa etiketi. */
export const INVOICES_PAGE_LABEL = 'Faturalar';

export const INVOICE_CREATE_PAGE_LABEL = 'Yeni fatura';

/**
 * Kenar çubuğunda ön muhasebe grubu gizli olsa bile (ör. paket + EXTERNAL_ERP)
 * fatura ekranları «Ön Muhasebe > Faturalar» bağlamını korur.
 */
export function resolveInvoicesNavGroupLabel(
  groupLabel: string | undefined,
  orgProducts: OrgProductLine[] | undefined,
  translate: (key: string) => string,
): string | undefined {
  if (groupLabel != null && groupLabel.length > 0) {
    return groupLabel;
  }
  if (hasOrgProductLine(orgProducts, 'ACCOUNTING')) {
    return translate(NAV_GROUP_LABEL_KEYS.nativeAccounting);
  }
  return groupLabel;
}

export function formatInvoicesNavContext(
  groupLabel: string | undefined,
  pageLabel: string,
  orgProducts: OrgProductLine[] | undefined,
  translate: (key: string) => string,
): string {
  return formatNavPageContext(
    resolveInvoicesNavGroupLabel(groupLabel, orgProducts, translate),
    pageLabel,
  );
}

/** `/invoices/:id` breadcrumb yaprak etiketi */
export function resolveInvoiceDetailBreadcrumbLabel(
  invoiceNumber: string | undefined,
): string {
  const trimmed = invoiceNumber?.trim();
  if (trimmed) {
    return trimmed;
  }
  return 'Fatura detayı';
}
