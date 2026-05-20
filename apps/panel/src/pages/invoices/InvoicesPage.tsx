import type { ReactElement } from 'react';
import { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  INVOICE_STATUS_BADGE,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_OPTIONS,
} from '@/lib/invoice-labels';
import type { InvoiceDto, InvoiceStatsDto, InvoiceStatus } from '@/types/invoice';

export function InvoicesPage(): ReactElement {
  usePageTitle('Faturalar');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [lineName, setLineName] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [linePrice, setLinePrice] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: ['invoices', 'stats'],
    queryFn: async (): Promise<InvoiceStatsDto> => {
      const { data } = await api.get<{ data: InvoiceStatsDto }>('/invoices/stats');
      return data.data;
    },
  });

  const listQuery = useQuery({
    queryKey: ['invoices', page, status, search, startDate, endDate],
    queryFn: async (): Promise<{
      items: InvoiceDto[];
      total: number;
    }> => {
      const { data } = await api.get<{
        items: InvoiceDto[];
        total: number;
      }>('/invoices', {
        params: {
          page,
          limit: 20,
          status: status === 'all' ? undefined : status,
          search: search.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (): Promise<InvoiceDto> => {
      const qty = Number(lineQty);
      const price = Number(linePrice);
      const { data } = await api.post<{ data: InvoiceDto }>('/invoices', {
        customerName: customerName.trim(),
        items: [{ name: lineName.trim(), quantity: qty, unitPrice: price }],
      });
      return data.data;
    },
    onSuccess: () => {
      toast.success('Fatura oluşturuldu.');
      setCreateOpen(false);
      setCustomerName('');
      setLineName('');
      setLineQty('1');
      setLinePrice('');
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      newStatus,
    }: {
      id: string;
      newStatus: InvoiceStatus;
    }): Promise<void> => {
      await api.patch(`/invoices/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      toast.success('Fatura durumu güncellendi.');
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const handleDownloadPdf = async (id: string, invoiceNumber: string): Promise<void> => {
    setDownloadingId(id);
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatura-${invoiceNumber.replace(/\//g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF indirildi.');
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setDownloadingId(null);
    }
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const canCreate =
    customerName.trim().length > 0 &&
    lineName.trim().length > 0 &&
    Number(lineQty) > 0 &&
    Number(linePrice) >= 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Faturalar</h1>
          <p className="text-sm text-muted-foreground">
            Satış faturalarınızı listeleyin, PDF indirin ve durumlarını yönetin.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Yeni Fatura
        </Button>
      </div>

      {statsQuery.isSuccess ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Toplam fatura</p>
            <p className="text-2xl font-semibold">{statsQuery.data.totalCount}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Bu ay fatura</p>
            <p className="text-2xl font-semibold">{statsQuery.data.monthCount}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Bu ay gelir (gönderildi/ödendi)</p>
            <p className="text-2xl font-semibold">
              {formatInvoiceAmount(statsQuery.data.monthRevenue, 'TRY')}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Fatura no veya müşteri ara…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {INVOICE_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="w-[160px]"
          aria-label="Başlangıç tarihi"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="w-[160px]"
          aria-label="Bitiş tarihi"
        />
      </div>

      {listQuery.isLoading ? <TableSkeleton cols={6} rows={8} /> : null}
      {listQuery.isError ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(listQuery.error)}</p>
      ) : null}
      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Henüz fatura yok"
          description="Yeni fatura oluşturun veya teslim edilen siparişlerden otomatik fatura üretin."
        />
      ) : null}

      {listQuery.isSuccess && items.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fatura No</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.customerName}</TableCell>
                  <TableCell>{formatInvoiceDate(inv.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {formatInvoiceAmount(inv.totalAmount, inv.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={INVOICE_STATUS_BADGE[inv.status]}
                    >
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingId === inv.id}
                        onClick={() => void handleDownloadPdf(inv.id, inv.invoiceNumber)}
                      >
                        {downloadingId === inv.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Download className="size-4" />
                        )}
                        <span className="sr-only sm:not-sr-only sm:ml-1">PDF</span>
                      </Button>
                      <Select
                        value={inv.status}
                        onValueChange={(v) =>
                          statusMutation.mutate({
                            id: inv.id,
                            newStatus: v as InvoiceStatus,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[130px]" aria-label="Durum güncelle">
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
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Toplam {total} kayıt — sayfa {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Fatura</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="customerName">Müşteri adı</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lineName">Ürün / hizmet</Label>
              <Input
                id="lineName"
                value={lineName}
                onChange={(e) => setLineName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lineQty">Adet</Label>
                <Input
                  id="lineQty"
                  type="number"
                  min={1}
                  value={lineQty}
                  onChange={(e) => setLineQty(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="linePrice">Birim fiyat (TRY)</Label>
                <Input
                  id="linePrice"
                  type="number"
                  min={0}
                  step="0.01"
                  value={linePrice}
                  onChange={(e) => setLinePrice(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              İptal
            </Button>
            <Button
              disabled={!canCreate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
