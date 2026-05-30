import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import type { InvoiceStatsDto } from '@/types/invoice';

import { formatInvoiceAmount } from './invoice-utils';
import { invoicesT } from './translations';

interface Props {
  stats: InvoiceStatsDto | undefined;
  isLoading: boolean;
}

const STAT_CARD_CLASS =
  'rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30';

export function InvoicesStatsRow({ stats, isLoading }: Props): ReactElement {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return <></>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={STAT_CARD_CLASS}>
        <p className="text-xs text-muted-foreground">{invoicesT('stats.total')}</p>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{stats.totalCount}</p>
      </div>
      <div className={STAT_CARD_CLASS}>
        <p className="text-xs text-muted-foreground">{invoicesT('stats.monthCount')}</p>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{stats.monthCount}</p>
      </div>
      <div className={STAT_CARD_CLASS}>
        <p className="text-xs text-muted-foreground">{invoicesT('stats.monthRevenue')}</p>
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {formatInvoiceAmount(stats.monthRevenue, 'TRY')}
        </p>
      </div>
      <Link
        to="/invoices?status=OVERDUE"
        className={`${STAT_CARD_CLASS} block ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      >
        <p className="text-xs text-muted-foreground">{invoicesT('stats.overdue')}</p>
        <p className="text-2xl font-semibold tabular-nums text-amber-800 dark:text-amber-200">
          {stats.overdueCount ?? 0}
        </p>
      </Link>
    </div>
  );
}
