import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Banknote, RefreshCw } from 'lucide-react';

import { TableSkeleton } from '@/components/TableSkeleton';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePartnerPayoutRequests } from './hooks/usePartner';
import { formatTry } from './partner-utils';

function payoutStatusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'APPROVED') {
    return 'default';
  }
  if (status === 'REJECTED') {
    return 'destructive';
  }
  return 'secondary';
}

export function PartnerCommissionPayoutRequestsTab(): ReactElement {
  const { t } = useTranslation();
  const { data, isPending, isFetching, isError, error, refetch } = usePartnerPayoutRequests();
  const rows = data ?? [];

  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <div className="flex justify-end">
          <div className="bg-muted h-9 w-24 animate-pulse rounded-md" />
        </div>
        <div className="rounded-md border p-4">
          <TableSkeleton rows={5} cols={4} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorAlert
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Banknote}
        title={t('partner.commission.emptyPayoutTitle')}
        description={t('partner.commission.emptyPayoutDescription')}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => {
            void refetch();
          }}
        >
          <RefreshCw
            className={`mr-2 size-4 ${isFetching ? 'animate-spin' : ''}`}
            aria-hidden
          />
          {t('partner.commission.refresh')}
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('partner.commission.table.date')}</TableHead>
              <TableHead className="text-right">
                {t('partner.commission.table.payoutAmount')}
              </TableHead>
              <TableHead>{t('partner.commission.table.status')}</TableHead>
              <TableHead>{t('partner.commission.table.processedAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const created = new Date(row.createdAt);
              const reviewed = row.reviewedAt ? new Date(row.reviewedAt) : null;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {Number.isNaN(created.getTime())
                      ? t('admin.common.emDash')
                      : format(created, 'd MMM yyyy HH:mm', { locale: tr })}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatTry(row.amountTRY)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={payoutStatusVariant(row.status)}>
                      {t(`partner.commission.payoutStatus.${row.status}`, {
                        defaultValue: row.status,
                      })}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {reviewed && !Number.isNaN(reviewed.getTime())
                      ? format(reviewed, 'd MMM yyyy HH:mm', { locale: tr })
                      : t('admin.common.emDash')}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
