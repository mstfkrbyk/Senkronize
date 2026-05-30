import { CheckCircle2, CircleDashed, Minus } from 'lucide-react';
import type { ReactElement } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { ErpInvoiceSyncInfo } from './useInvoiceErpStatus';
import { erpTypeLabel } from './invoice-utils';
import { invoicesT } from './translations';

interface Props {
  items: ErpInvoiceSyncInfo[];
  compact?: boolean;
}

function stateLabel(item: ErpInvoiceSyncInfo): string {
  switch (item.state) {
    case 'not_connected':
      return invoicesT('erp.notConnected');
    case 'no_order':
      return invoicesT('erp.noOrder');
    case 'pending':
      return invoicesT('erp.pending');
    case 'sent':
      return item.invoiceNo
        ? `${invoicesT('erp.sent')}: ${item.invoiceNo}`
        : invoicesT('erp.sent');
    default:
      return '';
  }
}

function StateIcon({ item }: { item: ErpInvoiceSyncInfo }): ReactElement {
  if (item.state === 'sent') {
    return <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  if (item.state === 'pending') {
    return <CircleDashed className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />;
  }
  return <Minus className="size-3.5 text-muted-foreground" aria-hidden />;
}

export function InvoiceErpStatusCell({ items, compact = true }: Props): ReactElement {
  const visible = items.filter((i) => i.state !== 'not_connected' || !compact);

  if (visible.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Tooltip key={item.erpType}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${
                  item.state === 'sent'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : item.state === 'pending'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                      : 'border-border bg-muted/50 text-muted-foreground'
                }`}
              >
                <StateIcon item={item} />
                <span className="font-medium">{erpTypeLabel(item.erpType)}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {stateLabel(item)}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
