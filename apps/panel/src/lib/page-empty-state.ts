import { isAccountingOnlyOrg } from '@/lib/org-products';
import type { OrgProductLine } from '@/types/auth';

export type PageEmptyProductVariant = 'integration' | 'accounting';

/** Tablo sayfaları ve boş durum CTA'ları için ürün hattı. */
export function resolvePageEmptyProductVariant(
  orgProducts: OrgProductLine[] | undefined,
): PageEmptyProductVariant {
  return isAccountingOnlyOrg(orgProducts) ? 'accounting' : 'integration';
}
