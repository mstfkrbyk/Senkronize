import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  ADMIN_ACCOUNTING_MODE_LABEL,
  adminAccountingModeBadgeClass,
} from '@/lib/admin-accounting-mode';
import { hasOrgProductLine } from '@/lib/org-products';
import {
  productSelectionFromOrgProducts,
  type ProductSelection,
} from '@/lib/product-selection';
import { cn } from '@/lib/utils';
import type { AccountingMode, OrgProductLine } from '@/types/auth';

const PRODUCT_LABEL: Record<ProductSelection, string> = {
  INTEGRATION: 'Entegrasyon',
  ACCOUNTING: 'Ön Muhasebe',
  BUNDLE: 'Paket',
};

interface Props {
  orgProducts: OrgProductLine[] | undefined;
  accountingMode?: AccountingMode | null;
  className?: string;
  variant?: 'default' | 'compact';
  /** Amber/koyu banner üzerinde beyaz outline */
  appearance?: 'default' | 'inverse';
}

const BADGE_CLASS: Record<NonNullable<Props['variant']>, string> = {
  default: 'px-1.5 py-0 text-[10px] font-normal',
  compact: 'h-4 shrink-0 px-1 py-0 text-[9px] font-normal leading-none',
};

const INVERSE_BADGE_CLASS =
  'border-white/50 bg-white/15 text-white hover:bg-white/15';

export function PartnerClientBadges({
  orgProducts,
  accountingMode,
  className,
  variant = 'default',
  appearance = 'default',
}: Props): ReactElement | null {
  const productSelection = productSelectionFromOrgProducts(orgProducts);
  const showAccountingMode =
    accountingMode != null &&
    (hasOrgProductLine(orgProducts, 'ACCOUNTING') ||
      productSelection === 'BUNDLE');

  if (!productSelection && !showAccountingMode) {
    return null;
  }

  const badgeClass = BADGE_CLASS[variant];
  const gapClass = variant === 'compact' ? 'gap-0.5' : 'gap-1';
  const inverse = appearance === 'inverse';

  return (
    <div className={cn('flex flex-wrap items-center', gapClass, className)}>
      {productSelection ? (
        <Badge
          variant="outline"
          className={cn(badgeClass, inverse && INVERSE_BADGE_CLASS)}
        >
          {PRODUCT_LABEL[productSelection]}
        </Badge>
      ) : null}
      {showAccountingMode && accountingMode ? (
        <Badge
          variant="outline"
          className={cn(
            badgeClass,
            inverse
              ? INVERSE_BADGE_CLASS
              : adminAccountingModeBadgeClass(accountingMode),
          )}
        >
          {ADMIN_ACCOUNTING_MODE_LABEL[accountingMode]}
        </Badge>
      ) : null}
    </div>
  );
}
