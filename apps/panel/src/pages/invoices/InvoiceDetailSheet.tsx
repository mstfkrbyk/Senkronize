import type { ReactElement } from 'react';
import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Loader2,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useSyncOrderToErp } from '@/hooks/useErpConnections';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  ACCOUNTING_PAYMENT_METHODS,
  type AccountingPaymentMethod,
  type InvoiceDto,
  type InvoiceStatus,
} from '@/types/invoice';

import { InvoiceErpStatusCell } from './InvoiceErpStatusCell';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import {
  formatInvoiceAmount,
  formatInvoiceDateTime,
  formatInvoiceDueDate,
  INVOICE_STATUS_OPTIONS,
  accountingPaymentMethodLabel,
  erpTypeLabel,
  isInvoiceIssueEligible,
  isInvoiceMarkPaidEligible,
} from './invoice-utils';
import { useInvoiceErpStatus } from './useInvoiceErpStatus';
import { useInvoicePdfPreview } from './useInvoicePdfPreview';
import { invoicesT } from './translations';

interface Props {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onErpSynced: () => void;
}

export function InvoiceDetailSheet({
  invoiceId,
  open,
  onOpenChange,
  onErpSynced,
}: Props): ReactElement {
  const { mode: accountingMode } = useAccountingMode();
  const isExternalErp = accountingMode === 'EXTERNAL_ERP';
  const { getErpStatusForInvoice } = useInvoiceErpStatus();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<AccountingPaymentMethod>('BANK_TRANSFER');
  const syncToErp = useSyncOrderToErp();

  const detailQuery = useQuery({
    queryKey: ['invoices', 'detail', invoiceId],
    enabled: open && !!invoiceId,
    queryFn: async (): Promise<InvoiceDto> => {
      const { data } = await api.get<{ data: InvoiceDto }>(`/invoices/${invoiceId}`);
      return data.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: InvoiceStatus): Promise<void> => {
      await api.patch(`/invoices/${invoiceId}/status`, { status: newStatus });
    },
    onSuccess: () => {
      toast.success(invoicesT('toast.statusUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const issueMutation = useMutation({
    mutationFn: async (): Promise<InvoiceDto> => {
      const { data } = await api.post<{ data: InvoiceDto }>(
        `/accounting/invoices/${invoiceId}/issue`,
      );
      return data.data;
    },
    onSuccess: () => {
      toast.success(invoicesT('toast.issueSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (method: AccountingPaymentMethod): Promise<InvoiceDto> => {
      const { data } = await api.post<{ data: InvoiceDto }>(
        `/accounting/invoices/${invoiceId}/mark-paid`,
        { paymentMethod: method },
      );
      return data.data;
    },
    onSuccess: () => {
      toast.success(invoicesT('toast.markPaidSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const inv = detailQuery.data;
  const issueEligible = inv ? isInvoiceIssueEligible(inv.status) : false;
  const markPaidEligible = inv ? isInvoiceMarkPaidEligible(inv.status) : false;
  const statusActionPending =
    issueMutation.isPending || markPaidMutation.isPending || statusMutation.isPending;
  const erpStatus = getErpStatusForInvoice(inv?.orderId ?? null);

  const pdfPreview = useInvoicePdfPreview({
    invoiceId: inv?.id ?? null,
    invoiceNumber: inv?.invoiceNumber,
    enabled: open && !!inv,
  });

  const handlePdfDownload = (): void => {
    if (!inv || pdfPreview.isLoading) {
      return;
    }
    if (pdfPreview.isError) {
      toast.error(pdfPreview.errorMessage ?? invoicesT('detail.pdfPreviewError'));
      return;
    }
    pdfPreview.download();
    toast.success(invoicesT('detail.pdfSuccess'));
  };

  const handleErpSend = (connectionId: string, orderId: string, erpType: string): void => {
    syncToErp.mutate(
      { connectionId, orderId },
      {
        onSuccess: (res) => {
          toast.success(
            invoicesT('erp.sendSuccess', {
              erp: erpTypeLabel(erpType),
              invoiceNo: res.invoiceNo,
            }),
          );
          onErpSynced();
          void queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] });
        },
        onError: (e: unknown) => {
          toast.error(getApiErrorMessage(e));
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{invoicesT('detail.title')}</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {inv?.invoiceNumber ?? '…'}
          </SheetDescription>
        </SheetHeader>

        {detailQuery.isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : null}

        {detailQuery.isError ? (
          <p className="mt-4 text-sm text-destructive">{getApiErrorMessage(detailQuery.error)}</p>
        ) : null}

        {inv ? (
          <div className="mt-6 flex flex-1 flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <InvoiceStatusBadge status={inv.status} />
              {inv.orderId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/orders/${inv.orderId}`}>
                    <ExternalLink className="mr-1 size-3.5" aria-hidden />
                    {invoicesT('detail.viewOrder')}
                  </Link>
                </Button>
              ) : null}
            </div>

            <section className="space-y-2" aria-labelledby="invoice-pdf-preview-heading">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3
                  id="invoice-pdf-preview-heading"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  {invoicesT('detail.pdfPreview')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pdfPreview.isLoading || pdfPreview.isError}
                    onClick={() => {
                      if (!pdfPreview.openInNewTab()) {
                        toast.error(invoicesT('detail.pdfPopupBlocked'));
                      }
                    }}
                  >
                    <ExternalLink className="mr-1 size-3.5" aria-hidden />
                    {invoicesT('detail.pdfOpenTab')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pdfPreview.isLoading || pdfPreview.isError}
                    onClick={handlePdfDownload}
                  >
                    {pdfPreview.isLoading ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Download className="mr-1 size-3.5" aria-hidden />
                    )}
                    {invoicesT('detail.pdfDownload')}
                  </Button>
                </div>
              </div>
              <div className="overflow-hidden rounded-md border border-border bg-muted/20">
                {pdfPreview.isLoading ? (
                  <div
                    className="flex min-h-[280px] items-center justify-center gap-2 p-6 text-sm text-muted-foreground"
                    role="status"
                  >
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    {invoicesT('detail.pdfPreviewLoading')}
                  </div>
                ) : null}
                {pdfPreview.isError ? (
                  <p className="min-h-[120px] p-4 text-sm text-destructive" role="alert">
                    {pdfPreview.errorMessage ?? invoicesT('detail.pdfPreviewError')}
                  </p>
                ) : null}
                {!pdfPreview.isLoading && !pdfPreview.isError && !pdfPreview.pdfUrl ? (
                  <p className="min-h-[120px] p-4 text-sm text-muted-foreground">
                    {invoicesT('detail.pdfPreviewEmpty')}
                  </p>
                ) : null}
                {pdfPreview.pdfUrl ? (
                  <iframe
                    title={invoicesT('detail.pdfPreview')}
                    src={pdfPreview.pdfUrl}
                    className="h-[min(420px,50vh)] w-full bg-white"
                  />
                ) : null}
              </div>
            </section>

            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{invoicesT('table.customer')}</dt>
                <dd className="text-right font-medium text-foreground">{inv.customerName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{invoicesT('table.date')}</dt>
                <dd className="text-foreground">{formatInvoiceDateTime(inv.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{invoicesT('detail.dueDate')}</dt>
                <dd
                  className={
                    inv.dueDate && inv.status === 'OVERDUE'
                      ? 'font-medium text-amber-800 dark:text-amber-200'
                      : 'text-foreground'
                  }
                >
                  {inv.dueDate
                    ? formatInvoiceDueDate(inv.dueDate)
                    : invoicesT('detail.dueDateNotSet')}
                </dd>
              </div>
              {inv.status === 'PAID' && inv.paidAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{invoicesT('detail.paidAt')}</dt>
                  <dd className="text-foreground">{formatInvoiceDateTime(inv.paidAt)}</dd>
                </div>
              ) : null}
              {inv.status === 'PAID' && inv.paymentMethod ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{invoicesT('detail.paymentMethod')}</dt>
                  <dd className="text-foreground">
                    {accountingPaymentMethodLabel(inv.paymentMethod)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{invoicesT('detail.eArchive')}</dt>
                <dd className="text-foreground">
                  {inv.isEArchive ? invoicesT('detail.yes') : invoicesT('detail.no')}
                </dd>
              </div>
            </dl>

            {isExternalErp ? (
              <div className="space-y-2">
                <Label className="text-muted-foreground">{invoicesT('erp.column')}</Label>
                <InvoiceErpStatusCell items={erpStatus} compact={false} />
                {inv.orderId
                  ? erpStatus
                      .filter((e) => e.state === 'pending' && e.connectionId)
                      .map((e) => (
                        <Button
                          key={e.erpType}
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="mr-2"
                          disabled={syncToErp.isPending}
                          onClick={() =>
                            handleErpSend(e.connectionId!, inv.orderId!, e.erpType)
                          }
                        >
                          {syncToErp.isPending ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Send className="mr-1 size-3.5" aria-hidden />
                          )}
                          {invoicesT('erp.send')} ({erpTypeLabel(e.erpType)})
                        </Button>
                      ))
                  : null}
              </div>
            ) : null}

            <section
              className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
              aria-labelledby="invoice-status-actions-heading"
            >
              <h3
                id="invoice-status-actions-heading"
                className="text-sm font-medium text-foreground"
              >
                {invoicesT('detail.statusActions')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {issueEligible ? (
                  <Button
                    type="button"
                    disabled={statusActionPending}
                    onClick={() => issueMutation.mutate()}
                  >
                    {issueMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    ) : (
                      <FileCheck className="mr-2 size-4" aria-hidden />
                    )}
                    {invoicesT('actions.issue')}
                  </Button>
                ) : null}
                {markPaidEligible ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={statusActionPending}
                    onClick={() => markPaidMutation.mutate(paymentMethod)}
                  >
                    {markPaidMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    ) : (
                      <Banknote className="mr-2 size-4" aria-hidden />
                    )}
                    {invoicesT('actions.markPaid')}
                  </Button>
                ) : null}
              </div>
              {markPaidEligible ? (
                <div className="grid gap-2">
                  <Label htmlFor="detailPaymentMethod">{invoicesT('paymentMethod.label')}</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as AccountingPaymentMethod)}
                    disabled={statusActionPending}
                  >
                    <SelectTrigger id="detailPaymentMethod" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNTING_PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {accountingPaymentMethodLabel(method)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="detailStatus">{invoicesT('actions.updateStatus')}</Label>
                <Select
                  value={inv.status}
                  onValueChange={(v) => statusMutation.mutate(v as InvoiceStatus)}
                  disabled={statusActionPending}
                >
                  <SelectTrigger id="detailStatus" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">{invoicesT('detail.lines')}</h3>
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{invoicesT('detail.product')}</TableHead>
                      <TableHead className="text-right">{invoicesT('detail.qty')}</TableHead>
                      <TableHead className="text-right">{invoicesT('detail.lineTotal')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inv.items.map((line, idx) => (
                      <TableRow key={`${line.name}-${String(idx)}`}>
                        <TableCell className="text-foreground">{line.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatInvoiceAmount(String(line.total), inv.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{invoicesT('detail.subtotal')}</span>
                  <span className="tabular-nums text-foreground">
                    {formatInvoiceAmount(inv.subtotal, inv.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {invoicesT('detail.tax')} (%{inv.taxRate})
                  </span>
                  <span className="tabular-nums text-foreground">
                    {formatInvoiceAmount(inv.taxAmount, inv.currency)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-foreground">
                  <span>{invoicesT('detail.total')}</span>
                  <span className="tabular-nums">
                    {formatInvoiceAmount(inv.totalAmount, inv.currency)}
                  </span>
                </div>
              </div>
            </div>

            {inv.notes ? (
              <div>
                <Label className="text-muted-foreground">{invoicesT('detail.notes')}</Label>
                <p className="mt-1 text-sm text-foreground">{inv.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
