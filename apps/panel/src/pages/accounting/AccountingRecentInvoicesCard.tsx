import type { ReactElement } from 'react';
import { useState } from 'react';

import type { UseQueryResult } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FileText, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InvoiceDetailSheet } from '@/pages/invoices/InvoiceDetailSheet';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceStatusBadge';
import {
  formatInvoiceAmount,
  formatInvoiceDate,
} from '@/pages/invoices/invoice-utils';
import type { InvoiceDto } from '@/types/invoice';

interface Props {
  query: UseQueryResult<InvoiceDto[]>;
}

export function AccountingRecentInvoicesCard({ query }: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const recent = query.data ?? [];
  const recentLoading = query.isLoading;
  const recentError = query.isError;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-muted-foreground" aria-hidden />
            <CardTitle className="text-lg">{t('accounting.recentInvoices')}</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/invoices">
              {t('accounting.viewAll')}
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {recentError ? (
            <div className="p-6">
              <QueryErrorAlert
                error={query.error}
                title={t('accounting.recentInvoicesError')}
                onRetry={() => {
                  void query.refetch();
                }}
              />
            </div>
          ) : recentLoading ? (
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                {t('accounting.recentInvoicesLoading')}
              </p>
              <TableSkeleton rows={5} cols={5} />
            </div>
          ) : recent.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title={t('accounting.emptyRecent')}
                description={t('accounting.emptyRecentDescription')}
                secondaryAction={{
                  label: t('accounting.viewAllInvoices'),
                  href: '/invoices',
                }}
              />
            </div>
          ) : (
            <div className="rounded-b-lg border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accounting.table.invoiceNumber')}</TableHead>
                    <TableHead>{t('accounting.table.customer')}</TableHead>
                    <TableHead>{t('accounting.table.date')}</TableHead>
                    <TableHead className="text-right">{t('accounting.table.amount')}</TableHead>
                    <TableHead>{t('accounting.table.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setDetailId(inv.id);
                        setDetailOpen(true);
                      }}
                    >
                      <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatInvoiceDate(inv.createdAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInvoiceAmount(inv.totalAmount, inv.currency)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDetailSheet
        invoiceId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onErpSynced={() => {
          void queryClient.invalidateQueries({ queryKey: ['audit-log', 'erp-invoices'] });
        }}
      />
    </>
  );
}
