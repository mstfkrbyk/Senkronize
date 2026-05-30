import type { ReactElement } from 'react';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Scale,
  ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import { formatCustomerDate, formatTryAmount } from '@/lib/customer-segments';
import { downloadCustomerStatementCsv } from '@/pages/customers/customer-statement-csv';
import type { CustomerStatementLine } from '@/pages/customers/customer-statement.types';
import { customersT, statementLineTypeLabel } from '@/pages/customers/translations';
import { useCustomerStatement } from '@/pages/customers/useCustomerStatement';

interface Props {
  customerId: string;
  queryEnabled?: boolean;
}

const STATEMENT_LINE_TYPE_BADGE: Record<
  CustomerStatementLine['type'],
  string
> = {
  INVOICE: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  PAYMENT:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
};

function statementLineTypeBadgeLabel(type: CustomerStatementLine['type']): string {
  return statementLineTypeLabel(type);
}

function statementLineDate(line: CustomerStatementLine): string {
  const iso =
    line.type === 'PAYMENT' ? (line.paidAt ?? line.date) : line.date;
  return formatCustomerDate(iso);
}

function balanceClass(balance: number): string {
  if (balance > 0) {
    return 'text-amber-600 dark:text-amber-400';
  }
  if (balance < 0) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  return 'text-muted-foreground';
}

export function CustomerStatementTab({
  customerId,
  queryEnabled = true,
}: Props): ReactElement {
  const statementQuery = useCustomerStatement(customerId, {
    enabled: queryEnabled,
  });

  if (statementQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-xs" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (statementQuery.isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm font-medium text-destructive">
            {customersT('statement.error.loadFailed')}
          </p>
          <p className="text-sm text-muted-foreground">
            {getApiErrorMessage(statementQuery.error)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void statementQuery.refetch()}
          >
            {customersT('statement.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statement = statementQuery.data;
  if (!statement) {
    return (
      <EmptyState
        icon={ScrollText}
        title={customersT('statement.empty.unavailableTitle')}
        description={customersT('statement.empty.unavailableDescription')}
      />
    );
  }

  const showUnavailableEmpty = statement.unavailable;
  const showNoLinesEmpty =
    !statement.unavailable && statement.lines.length === 0;
  const canExportCsv =
    !statement.unavailable && statement.lines.length > 0;

  const handleExportCsv = (): void => {
    if (!canExportCsv) {
      toast.message(customersT('statement.export.noData'));
      return;
    }
    downloadCustomerStatementCsv(customerId, statement.lines, {
      totalDebit: statement.totalDebit,
      totalCredit: statement.totalCredit,
      balance: statement.balance,
    });
    toast.success(customersT('statement.export.success'));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {customersT('statement.summary.totalDebit')}
            </CardTitle>
            <ArrowUpRight className="size-4 text-amber-500 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatTryAmount(statement.totalDebit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {customersT('statement.summary.totalCredit')}
            </CardTitle>
            <ArrowDownLeft className="size-4 text-emerald-500 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatTryAmount(statement.totalCredit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {customersT('statement.summary.balance')}
            </CardTitle>
            <Scale className="size-4 text-sky-500 dark:text-sky-400" />
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold tabular-nums ${balanceClass(statement.balance)}`}
            >
              {formatTryAmount(statement.balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4" />
            {customersT('statement.tab')}
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canExportCsv}
            onClick={handleExportCsv}
          >
            <Download className="mr-2 size-4" />
            {customersT('statement.export.csv')}
          </Button>
        </CardHeader>
        <CardContent>
          {showUnavailableEmpty ? (
            <EmptyState
              icon={ScrollText}
              title={customersT('statement.empty.unavailableTitle')}
              description={customersT('statement.empty.unavailableDescription')}
            />
          ) : showNoLinesEmpty ? (
            <EmptyState
              icon={ScrollText}
              title={customersT('statement.empty.noLinesTitle')}
              description={customersT('statement.empty.noLinesDescription')}
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{customersT('statement.table.date')}</TableHead>
                    <TableHead>{customersT('statement.table.type')}</TableHead>
                    <TableHead>{customersT('statement.table.description')}</TableHead>
                    <TableHead className="text-right">
                      {customersT('statement.table.debit')}
                    </TableHead>
                    <TableHead className="text-right">
                      {customersT('statement.table.credit')}
                    </TableHead>
                    <TableHead className="text-right">
                      {customersT('statement.table.balance')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {statementLineDate(line)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATEMENT_LINE_TYPE_BADGE[line.type]}
                        >
                          {statementLineTypeBadgeLabel(line.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {line.description}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.debit > 0 ? formatTryAmount(line.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.credit > 0 ? formatTryAmount(line.credit) : '—'}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${balanceClass(line.balance)}`}
                      >
                        {formatTryAmount(line.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
