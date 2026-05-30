import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { hasOrgProductLine } from '@/lib/org-products';
import { cn } from '@/lib/utils';
import type { OrgProductLine } from '@/types/auth';

const LINE_LABELS: Record<OrgProductLine, string> = {
  INTEGRATION: 'Entegrasyon',
  ACCOUNTING: 'Muhasebe',
};

interface Props {
  orgProducts: OrgProductLine[] | undefined;
  className?: string;
  variant?: 'default' | 'compact';
}

const BADGE_CLASS: Record<NonNullable<Props['variant']>, string> = {
  default: 'px-1.5 py-0 text-[10px] font-normal',
  compact: 'h-4 shrink-0 px-1 py-0 text-[9px] font-normal leading-none',
};

export function OrgProductLineBadges({
  orgProducts,
  className,
  variant = 'default',
}: Props): ReactElement | null {
  const showIntegration = hasOrgProductLine(orgProducts, 'INTEGRATION');
  const showAccounting = hasOrgProductLine(orgProducts, 'ACCOUNTING');

  if (!showIntegration && !showAccounting) {
    return null;
  }

  const badgeClass = BADGE_CLASS[variant];
  const gapClass = variant === 'compact' ? 'gap-0.5' : 'gap-1';

  return (
    <div className={cn('flex flex-wrap items-center', gapClass, className)}>
      {showIntegration ? (
        <Badge variant="outline" className={badgeClass}>
          {LINE_LABELS.INTEGRATION}
        </Badge>
      ) : null}
      {showAccounting ? (
        <Badge variant="outline" className={badgeClass}>
          {LINE_LABELS.ACCOUNTING}
        </Badge>
      ) : null}
    </div>
  );
}
