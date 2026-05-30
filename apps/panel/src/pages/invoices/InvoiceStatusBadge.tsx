import type { ReactElement } from 'react';

import { Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/types/invoice';

import { INVOICE_STATUS_BADGE, invoiceStatusLabel } from './invoice-utils';

interface Props {
  status: InvoiceStatus;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: Props): ReactElement {
  const isOverdue = status === 'OVERDUE';

  return (
    <Badge
      variant="secondary"
      className={cn(
        INVOICE_STATUS_BADGE[status],
        isOverdue && 'gap-1 ring-1 ring-amber-500/50',
        className,
      )}
    >
      {isOverdue ? <Clock className="size-3 shrink-0" aria-hidden /> : null}
      {invoiceStatusLabel(status)}
    </Badge>
  );
}
