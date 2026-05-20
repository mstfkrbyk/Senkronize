import type { ReactElement } from 'react';
import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileArchive,
  FileText,
  Loader2,
  MessageSquarePlus,
  Truck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ShipOrderModal } from '@/components/orders/ShipOrderModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, getApiErrorMessage } from '@/lib/api';
import { downloadOrdersCsv } from '@/lib/order-export';
import { track } from '@/lib/analytics';
import type { InvoiceDto } from '@/types/invoice';
import type { BulkResult, Order } from '@/types/order';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  selectedOrderIds: string[];
  selectedOrders: Order[];
  onClearSelection: () => void;
}

export function OrderBulkActions({
  selectedOrderIds,
  selectedOrders,
  onClearSelection,
}: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [shipOpen, setShipOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteInternal, setNoteInternal] = useState(true);

  const bulkInvoiceZipMutation = useMutation({
    mutationFn: async (orderIds: string[]): Promise<Blob> => {
      const res = await api.post('/orders/bulk/invoice', { orderIds }, { responseType: 'blob' });
      return res.data as Blob;
    },
    onSuccess: (blob) => {
      downloadBlob(blob, `faturalar-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success(t('orders.bulk.invoiceZipSuccess'));
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const bulkCreateInvoicesMutation = useMutation({
    mutationFn: async (orderIds: string[]): Promise<number> => {
      let ok = 0;
      for (const id of orderIds) {
        try {
          await api.post<{ data: InvoiceDto }>(`/invoices/from-order/${id}`);
          ok += 1;
        } catch {
          /* continue */
        }
      }
      if (ok === 0) {
        throw new Error(t('orders.bulk.createInvoiceFailed'));
      }
      return ok;
    },
    onSuccess: (ok, orderIds) => {
      toast.success(t('orders.bulk.createInvoiceSuccess', { count: ok }));
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      track('orders_bulk_create_invoice', { count: orderIds.length, success: ok });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const bulkNotesMutation = useMutation({
    mutationFn: async (payload: {
      orderIds: string[];
      content: string;
      isInternal: boolean;
    }): Promise<BulkResult> => {
      const results = await Promise.allSettled(
        payload.orderIds.map((orderId) =>
          api.post(`/orders/${orderId}/notes`, {
            content: payload.content,
            isInternal: payload.isInternal,
          }),
        ),
      );
      const errors: { id: string; message: string }[] = [];
      let success = 0;
      payload.orderIds.forEach((id, index) => {
        const r = results[index];
        if (r?.status === 'fulfilled') {
          success += 1;
        } else {
          errors.push({ id, message: getApiErrorMessage(r?.reason) });
        }
      });
      return {
        success,
        failed: payload.orderIds.length - success,
        errors,
      };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (result.failed > 0) {
        toast.warning(
          t('orders.bulk.partialSuccess', {
            success: result.success,
            failed: result.failed,
          }),
        );
      } else {
        toast.success(t('orders.bulk.noteSuccess'));
      }
      setNoteOpen(false);
      setNoteText('');
      onClearSelection();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  if (selectedOrderIds.length === 0) {
    return <></>;
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur dark:shadow-[0_-4px_16px_rgba(0,0,0,0.45)] supports-[padding:max(0px)]:pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Badge variant="secondary" className="w-fit">
            {t('orders.bulk.selected', { count: selectedOrderIds.length })}
          </Badge>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={selectedOrders.length === 0}
              onClick={() => {
                setShipOpen(true);
              }}
            >
              <Truck className="h-3.5 w-3.5" aria-hidden />
              {t('orders.bulk.ship')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={
                selectedOrders.length === 0 || bulkCreateInvoicesMutation.isPending
              }
              onClick={() => {
                bulkCreateInvoicesMutation.mutate(selectedOrderIds);
              }}
            >
              {bulkCreateInvoicesMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <FileText className="h-3.5 w-3.5" aria-hidden />
              )}
              {t('orders.bulk.createInvoices')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={
                selectedOrders.length === 0 ||
                selectedOrders.length > 50 ||
                bulkInvoiceZipMutation.isPending
              }
              onClick={() => {
                bulkInvoiceZipMutation.mutate(selectedOrderIds);
                track('orders_bulk_invoice', { count: selectedOrderIds.length });
              }}
            >
              {bulkInvoiceZipMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <FileArchive className="h-3.5 w-3.5" aria-hidden />
              )}
              {t('orders.bulk.bulkInvoice')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={selectedOrders.length === 0}
              onClick={() => {
                downloadOrdersCsv(selectedOrders);
                track('orders_exported', {
                  count: selectedOrders.length,
                  format: 'csv',
                });
                toast.success(t('orders.bulk.exportCsvSuccess'));
              }}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {t('orders.bulk.exportCsv')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={selectedOrders.length === 0}
              onClick={() => {
                setNoteOpen(true);
              }}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
              {t('orders.bulk.addNote')}
            </Button>
          </div>
        </div>
      </div>

      <ShipOrderModal
        open={shipOpen}
        onOpenChange={setShipOpen}
        order={null}
        orderIds={selectedOrderIds}
        onSuccess={() => {
          onClearSelection();
        }}
      />

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('orders.bulk.noteTitle')}</DialogTitle>
            <DialogDescription>
              {t('orders.bulk.noteDescription', { count: selectedOrderIds.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Textarea
              rows={4}
              value={noteText}
              placeholder={t('orders.bulk.notePlaceholder')}
              onChange={(e) => {
                setNoteText(e.target.value);
              }}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-note-internal"
                checked={noteInternal}
                onCheckedChange={(v) => {
                  setNoteInternal(v === true);
                }}
              />
              <Label htmlFor="bulk-note-internal" className="text-sm font-normal">
                {t('orders.detail.notes.internal')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNoteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                bulkNotesMutation.isPending || noteText.trim().length === 0
              }
              onClick={() => {
                bulkNotesMutation.mutate({
                  orderIds: selectedOrderIds,
                  content: noteText.trim(),
                  isInternal: noteInternal,
                });
              }}
            >
              {bulkNotesMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {t('orders.bulk.noteSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
