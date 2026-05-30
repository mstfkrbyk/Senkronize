import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { ADMIN_ACCOUNTING_MODE_LABEL } from '@/lib/admin-accounting-mode';
import type { AccountingMode } from '@/types/auth';
import { cn } from '@/lib/utils';

interface Props {
  mode: AccountingMode;
  className?: string;
}

/** Panel bağlantı ve ayar sayfalarında muhasebe modu rozeti */
export function AccountingModeBadge({ mode, className }: Props): ReactElement {
  const label = ADMIN_ACCOUNTING_MODE_LABEL[mode];
  const tone =
    mode === 'NATIVE'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-sky-200 bg-sky-50 text-sky-900';

  return (
    <Badge variant="outline" className={cn('font-medium', tone, className)}>
      {label}
    </Badge>
  );
}
