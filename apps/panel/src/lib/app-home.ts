import type {
  AccountingMode,
  OrgProductLine,
  OrgType,
} from '@/types/auth';

import { resolveOrgHomePath } from '@/lib/org-products';

export interface ResolveAppHomeInput {
  type: OrgType | undefined;
  orgProducts: OrgProductLine[] | undefined;
  isImpersonating: boolean;
  accountingMode?: AccountingMode;
}

/** Giriş ve `/` yönlendirmesi — partner kendi paneline, diğerleri ürün hattına göre. */
export function resolveAppHomePath({
  type,
  orgProducts,
  isImpersonating,
  accountingMode,
}: ResolveAppHomeInput): '/partner' | '/dashboard' | '/accounting' {
  if (type === 'PARTNER' && !isImpersonating) {
    return '/partner';
  }
  return resolveOrgHomePath(orgProducts, undefined, accountingMode);
}
