import type { ReactElement } from 'react';
import { useState } from 'react';

import { Download, ExternalLink, Loader2 } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getApiErrorMessage } from '@/lib/api';
import type { InvoiceDto, InvoiceStatus } from '@/types/invoice';

import { InvoiceErpStatusCell } from './InvoiceErpStatusCell';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import {
  downloadInvoicePdf,
  formatInvoiceAmount,
  formatInvoiceDate,
  INVOICE_STATUS_OPTIONS,
} from './invoice-utils';
import type { ErpInvoiceSyncInfo } from './useInvoiceErpStatus';
import { invoicesT } from './translations';

interface Props {
  items: InvoiceDto[];
  getErpStatus: (orderId: string | null) => ErpInvoiceSyncInfo[];
  showErpColumn?: boolean;
  onOpenDetail: (id: string) => void;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
  statusChangingId: string | null;
  selectionEnabled?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
  onTogglePage?: () => void;
  pageAllSelected?: boolean;
  pageSomeSelected?: boolean;
}

export function InvoicesTable({
  items,
  getErpStatus,
  showErpColumn = false,
  onOpenDetail,
  onStatusChange,
  statusChangingId,
  selectionEnabled = false,
  selectedIds,
  onToggleRow,
  onTogglePage,
  pageAllSelected = false,
  pageSomeSelected = false,
}: Props): ReactElement {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (inv: InvoiceDto): Promise<void> => {
    setDownloadingId(inv.id);
    try {
      await downloadInvoicePdf(inv.id, inv.invoiceNumber, (url, cfg) => api.get(url, cfg));
      toast.success(invoicesT('detail.pdfSuccess'));
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionEnabled ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={pageAllSelected ? true : pageSomeSelected ? 'indeterminate' : false}
                  onCheckedChange={() => onTogglePage?.()}
                  aria-label="Sayfadaki tüm faturaları seç"
                />
              </TableHead>
            ) : null}
            <TableHead>{invoicesT('table.invoiceNumber')}</TableHead>
            <TableHead>{invoicesT('table.customer')}</TableHead>
            <TableHead>{invoicesT('table.date')}</TableHead>
            <TableHead className="text-right">{invoicesT('table.amount')}</TableHead>
            <TableHead>{invoicesT('table.status')}</TableHead>
            {showErpColumn ? <TableHead>{invoicesT('erp.column')}</TableHead> : null}
            <TableHead className="text-right">{invoicesT('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((inv) => (
            <TableRow
              key={inv.id}
              className="cursor-pointer"
              onClick={() => onOpenDetail(inv.id)}
            >
              {selectionEnabled ? (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds?.has(inv.id) ?? false}
                    onCheckedChange={() => onToggleRow?.(inv.id)}
                    aria-label={`${inv.invoiceNumber} seç`}
                  />
                </TableCell>
              ) : null}
              <TableCell className="font-mono text-sm text-foreground">
                {inv.invoiceNumber}
              </TableCell>
              <TableCell className="text-foreground">{inv.customerName}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatInvoiceDate(inv.createdAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground">
                {formatInvoiceAmount(inv.totalAmount, inv.currency)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <InvoiceStatusBadge status={inv.status} />
              </TableCell>
              {showErpColumn ? (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <InvoiceErpStatusCell items={getErpStatus(inv.orderId)} />
                </TableCell>
              ) : null}
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-2">
                  {inv.orderId ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        to={`/orders/${inv.orderId}`}
                        aria-label={invoicesT('detail.viewOrder')}
                      >
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloadingId === inv.id}
                    onClick={() => void handleDownload(inv)}
                  >
                    {downloadingId === inv.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="size-4" aria-hidden />
                    )}
                    <span className="sr-only sm:not-sr-only sm:ml-1">{invoicesT('table.pdf')}</span>
                  </Button>
                  <Select
                    value={inv.status}
                    disabled={statusChangingId === inv.id}
                    onValueChange={(v) => onStatusChange(inv.id, v as InvoiceStatus)}
                  >
                    <SelectTrigger
                      className="h-8 w-[130px]"
                      aria-label={invoicesT('actions.updateStatus')}
                    >
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
