import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { stockStatusFromQuantity } from '@/pages/products/productStockStatus';
import { cn } from '@/lib/utils';

interface Props {
  quantity: number;
}

export function ProductStockStatusBadge({ quantity }: Props): ReactElement {
  const status = stockStatusFromQuantity(quantity);

  return (
    <Badge
      variant={status === 'out' ? 'destructive' : 'outline'}
      className={cn(
        'tabular-nums font-semibold',
        status === 'low' &&
          'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100',
        status === 'ok' &&
          'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
      )}
    >
      {quantity}
    </Badge>
  );
}
