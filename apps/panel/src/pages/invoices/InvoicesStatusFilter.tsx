import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InvoiceListMeta } from '@/types/invoice';

import { invoicesT } from './translations';

const META_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE'] as const;

function sumMetaCounts(meta: InvoiceListMeta): number {
  return META_STATUSES.reduce((sum, key) => sum + meta[key], 0);
}

function cancelledCount(meta: InvoiceListMeta, totalAll: number): number {
  return Math.max(0, totalAll - sumMetaCounts(meta));
}

type TabCountFn = (meta: InvoiceListMeta, totalAll: number | undefined) => number | undefined;

const STATUS_TABS: {
  value: string;
  label: () => string;
  count?: TabCountFn;
}[] = [
  {
    value: 'all',
    label: () => invoicesT('filters.statusAll'),
    count: (_meta, totalAll) => totalAll,
  },
  ...META_STATUSES.map((status) => ({
    value: status,
    label: () => invoicesT(`status.${status}`),
    count: (meta: InvoiceListMeta) => meta[status],
  })),
  {
    value: 'CANCELLED',
    label: () => invoicesT('status.CANCELLED'),
    count: (meta, totalAll) =>
      totalAll === undefined ? undefined : cancelledCount(meta, totalAll),
  },
];

interface Props {
  value: string;
  meta: InvoiceListMeta | undefined;
  /** GET /invoices — status filtresi olmadan, arama/tarih ile uyumlu toplam kayıt */
  totalAll: number | undefined;
  isLoading: boolean;
  onChange: (status: string) => void;
}

export function InvoicesStatusFilter({
  value,
  meta,
  totalAll,
  isLoading,
  onChange,
}: Props): ReactElement {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label={invoicesT('filters.status')}
    >
      {STATUS_TABS.map((tab) => {
        const active = value === tab.value;
        const count =
          meta && tab.count ? tab.count(meta, totalAll) : undefined;
        return (
          <Button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            variant={active ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => onChange(tab.value)}
          >
            {tab.label()}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  'tabular-nums rounded-full px-1.5 py-0.5 text-xs',
                  active
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {isLoading ? '…' : String(count ?? 0)}
              </span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}
