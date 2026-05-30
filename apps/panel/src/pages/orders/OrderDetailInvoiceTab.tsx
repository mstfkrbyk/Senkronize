import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileDown, FileText, Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useErpConnections, useSyncOrderToErp } from '@/hooks/useErpConnections';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { hasOrgProductLine } from '@/lib/org-products';
import { InvoiceErpStatusCell } from '@/pages/invoices/InvoiceErpStatusCell';
import { InvoiceOverdueWarning } from '@/pages/invoices/InvoiceOverdueWarning';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceStatusBadge';
import {
  downloadInvoicePdf,
  erpTypeLabel,
  formatInvoiceAmount,
  formatInvoiceDate,
} from '@/pages/invoices/invoice-utils';
import { invoicesT } from '@/pages/invoices/translations';
import { useInvoiceErpStatus } from '@/pages/invoices/useInvoiceErpStatus';
import { useAuthStore } from '@/store/auth.store';
import type { InvoiceDto } from '@/types/invoice';
import type { Order } from '@/types/order';

interface Props {
  orderId: string;
  order: Order;
}

export function OrderDetailInvoiceTab({ orderId, order }: Props): ReactElement {
  const { t } = useTranslation();
  const { mode, isLoading: modeLoading } = useAccountingMode();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const hasAccounting = hasOrgProductLine(orgProducts, 'ACCOUNTING');

  if (modeLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (mode === 'EXTERNAL_ERP') {
    return <ExternalErpInvoicePanel orderId={orderId} />;
  }

  if (!hasAccounting) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('orders.detail.invoice.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('orders.detail.invoice.nativeUnavailable')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <NativeInvoicePanel orderId={orderId} order={order} />;
}

function NativeInvoicePanel({
  orderId,
  order,
}: {
  orderId: string;
  order: Order;
}): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const invoiceQuery = useQuery({
    queryKey: ['invoices', 'by-order', orderId],
    queryFn: async (): Promise<InvoiceDto | null> => {
      const { data } = await api.get<{ items: InvoiceDto[] }>('/invoices', {
        params: { orderId, limit: 1, page: 1 },
      });
      return data.items[0] ?? null;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (): Promise<InvoiceDto> => {
      const { data } = await api.post<{ data: InvoiceDto }>(
        `/invoices/from-order/${orderId}`,
      );
      return data.data;
    },
    onSuccess: () => {
      toast.success(t('orders.detail.documents.invoiceCreated'));
      void queryClient.invalidateQueries({ queryKey: ['invoices', 'by-order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const pdfMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const inv = invoiceQuery.data;
      if (inv) {
        await downloadInvoicePdf(inv.id, inv.invoiceNumber, (url, cfg) => api.get(url, cfg));
        return;
      }
      const res = await api.get(`/invoices/order/${orderId}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatura-${order.platformOrderId.replace(/\//g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast.success(t('orders.detail.documents.pdfDownloaded'));
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const invoice = invoiceQuery.data;
  const hasInvoice =
    invoice !== null ||
    order.status === 'INVOICED' ||
    order.status === 'DELIVERED';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('orders.detail.invoice.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            'rounded-md border bg-muted/20 p-4 text-sm dark:bg-muted/10',
            invoice?.status === 'OVERDUE' && 'border-amber-500/50 bg-amber-500/5',
          )}
        >
          <p className="text-muted-foreground">{t('orders.detail.documents.status')}</p>
          {invoiceQuery.isLoading ? (
            <Skeleton className="mt-2 h-5 w-40" />
          ) : (
            <>
              <p className="mt-1 font-medium">
                {hasInvoice
                  ? t('orders.detail.documents.created')
                  : t('orders.detail.documents.notCreated')}
              </p>
              {invoice ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <InvoiceStatusBadge status={invoice.status} />
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 font-mono text-xs"
                      asChild
                    >
                      <Link
                        to={`/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`}
                      >
                        {t('orders.detail.documents.invoiceNo', {
                          no: invoice.invoiceNumber,
                        })}
                        <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden />
                      </Link>
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {formatInvoiceDate(invoice.createdAt)} ·{' '}
                      {formatInvoiceAmount(invoice.totalAmount, invoice.currency)}
                    </span>
                  </div>
                  {invoice.status === 'OVERDUE' ? (
                    <InvoiceOverdueWarning
                      dueDate={invoice.dueDate}
                      className="mt-3"
                      hideCta
                    />
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            className="gap-1"
            disabled={createMutation.isPending || !!invoice}
            onClick={() => {
              createMutation.mutate();
            }}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-4 w-4" aria-hidden />
            )}
            {t('orders.detail.documents.createInvoice')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1"
            disabled={pdfMutation.isPending || invoiceQuery.isLoading}
            onClick={() => {
              pdfMutation.mutate();
            }}
          >
            {pdfMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="h-4 w-4" aria-hidden />
            )}
            {t('orders.detail.documents.downloadPdf')}
          </Button>
          {invoice ? (
            <Button type="button" variant="outline" className="gap-1" asChild>
              <Link to={`/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`}>
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t('orders.detail.invoice.openInList')}
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ExternalErpInvoicePanel({ orderId }: { orderId: string }): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { getErpStatusForInvoice, isLoading: erpStatusLoading } = useInvoiceErpStatus();
  const erpConnectionsQuery = useErpConnections();
  const syncToErp = useSyncOrderToErp();

  const activeConnections = useMemo(
    () =>
      (erpConnectionsQuery.data ?? []).filter(
        (c) => c.isActive && c.role === 'PRIMARY',
      ),
    [erpConnectionsQuery.data],
  );

  const [erpConnectionId, setErpConnectionId] = useState('');

  useEffect(() => {
    if (!erpConnectionId && activeConnections.length > 0) {
      setErpConnectionId(activeConnections[0]!.id);
    }
  }, [activeConnections, erpConnectionId]);

  const erpStatus = getErpStatusForInvoice(orderId);
  const sentCount = erpStatus.filter((e) => e.state === 'sent').length;

  const handleErpSend = (connectionId: string, erpType: string): void => {
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
          void queryClient.invalidateQueries({ queryKey: ['audit-log', 'erp-invoices'] });
          void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
        },
        onError: (err: unknown) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('orders.detail.invoice.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('orders.detail.invoice.externalErpIntro')}</p>
        <div className="rounded-md border bg-muted/20 p-4 text-sm dark:bg-muted/10">
          <p className="text-muted-foreground">{t('orders.detail.invoice.erpStatus')}</p>
          {erpStatusLoading ? (
            <Skeleton className="mt-2 h-8 w-full max-w-md" />
          ) : (
            <>
              <p className="mt-1 font-medium">
                {sentCount > 0
                  ? t('orders.detail.invoice.erpSent', { count: sentCount })
                  : t('orders.detail.invoice.erpPending')}
              </p>
              <div className="mt-3">
                <InvoiceErpStatusCell items={erpStatus} compact={false} />
              </div>
            </>
          )}
        </div>

        {activeConnections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('orders.detail.invoice.noErpConnection')}
          </p>
        ) : (
          <div className="space-y-3">
            {erpStatus
              .filter((e) => e.state === 'pending' && e.connectionId)
              .map((e) => (
                <Button
                  key={e.erpType}
                  type="button"
                  variant="default"
                  className="gap-1"
                  disabled={syncToErp.isPending}
                  onClick={() => {
                    handleErpSend(e.connectionId!, e.erpType);
                  }}
                >
                  {syncToErp.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  {syncToErp.isPending
                    ? invoicesT('erp.sending')
                    : `${t('orders.detail.invoice.sendToErp')} (${erpTypeLabel(e.erpType)})`}
                </Button>
              ))}
            {erpStatus.filter((e) => e.state === 'pending' && e.connectionId).length ===
            0 ? (
              <div className="space-y-2">
                <div className="space-y-2">
                  <Label htmlFor="order-erp-conn">{t('orders.detail.invoice.erpConnection')}</Label>
                  <Select value={erpConnectionId} onValueChange={setErpConnectionId}>
                    <SelectTrigger id="order-erp-conn">
                      <SelectValue
                        placeholder={t('orders.detail.invoice.erpConnectionPlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {activeConnections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {erpTypeLabel(c.erpType)}
                          {c.accountLabel ? ` (${c.accountLabel})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="default"
                  className="gap-1"
                  disabled={!erpConnectionId || syncToErp.isPending}
                  onClick={() => {
                    const conn = activeConnections.find((c) => c.id === erpConnectionId);
                    if (!conn) {
                      return;
                    }
                    handleErpSend(conn.id, conn.erpType);
                  }}
                >
                  {syncToErp.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  {syncToErp.isPending
                    ? invoicesT('erp.sending')
                    : t('orders.detail.invoice.sendToErp')}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <Button type="button" variant="link" className="h-auto p-0 text-xs" asChild>
          <Link to="/connections?tab=erp">{t('orders.detail.invoice.manageConnections')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
