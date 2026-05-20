import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  PackageCheck,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { PO_STATUS_LABEL_TR, poStatusBadgeClass } from '@/lib/po-status';
import { cn } from '@/lib/utils';
import { formatSupplierDate, formatTryAmount } from '@/pages/suppliers/supplier-utils';
import type { POStatus, PurchaseOrderDetailDto, PurchaseOrderItemDto } from '@/types/supply';

const TIMELINE_STEPS: Array<{ status: POStatus; label: string }> = [
  { status: 'DRAFT', label: 'Taslak' },
  { status: 'SENT', label: 'Gönderildi' },
  { status: 'CONFIRMED', label: 'Onaylandı' },
  { status: 'PARTIALLY_RECEIVED', label: 'Kısmen teslim' },
  { status: 'RECEIVED', label: 'Teslim alındı' },
];

function statusIndex(status: POStatus): number {
  if (status === 'CANCELLED') {
    return -1;
  }
  const idx = TIMELINE_STEPS.findIndex((s) => s.status === status);
  return idx >= 0 ? idx : 0;
}

async function downloadPoPdf(poId: string, orderNumber: string): Promise<void> {
  const { data } = await api.get<Blob>(`/purchase-orders/${poId}/pdf`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `satinalma-${orderNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PurchaseOrderDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const poId = id ?? '';
  const queryClient = useQueryClient();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['purchase-order', poId],
    enabled: poId.length > 0,
    queryFn: async (): Promise<PurchaseOrderDetailDto> => {
      const { data } = await api.get<{ data: PurchaseOrderDetailDto }>(
        `/purchase-orders/${poId}`,
      );
      return data.data;
    },
  });

  const po = detailQuery.data;

  useEffect(() => {
    if (detailQuery.data && !notesDirty) {
      setNotes(detailQuery.data.notes ?? '');
    }
  }, [detailQuery.data, notesDirty]);

  usePageTitle(po?.orderNumber ?? 'Sipariş');

  const sendMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(`/purchase-orders/${poId}/send`);
    },
    onSuccess: async () => {
      toast.success('Sipariş tedarikçiye gönderildi.');
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(`/purchase-orders/${poId}/confirm`);
    },
    onSuccess: async () => {
      toast.success('Sipariş onaylandı.');
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(`/purchase-orders/${poId}/cancel`);
    },
    onSuccess: async () => {
      toast.success('Sipariş iptal edildi.');
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (
      items: Array<{ barcode: string; receivedQty: number }>,
    ): Promise<void> => {
      await api.post(`/purchase-orders/${poId}/receive`, { items });
    },
    onSuccess: async () => {
      toast.success('Mal teslim alındı, stok güncellendi.');
      setReceiveQty({});
      setReceiveOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const saveNotesMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.patch(`/purchase-orders/${poId}`, { notes: notes.trim() || null });
    },
    onSuccess: async () => {
      toast.success('Notlar kaydedildi.');
      setNotesDirty(false);
      await queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const currentStep = useMemo(() => (po ? statusIndex(po.status) : 0), [po]);

  const handleReceiveSubmit = (): void => {
    if (!po) {
      return;
    }
    const items: Array<{ barcode: string; receivedQty: number }> = [];
    for (const it of po.items) {
      const raw = receiveQty[it.id]?.trim();
      if (!raw) {
        continue;
      }
      const q = Number.parseInt(raw, 10);
      if (Number.isFinite(q) && q > 0) {
        items.push({ barcode: it.barcode, receivedQty: q });
      }
    }
    if (items.length === 0) {
      toast.error('En az bir ürün için teslim miktarı girin.');
      return;
    }
    receiveMutation.mutate(items);
  };

  const openReceiveDialog = (): void => {
    if (!po) {
      return;
    }
    const initial: Record<string, string> = {};
    for (const it of po.items) {
      const remaining = it.orderedQty - it.receivedQty;
      if (remaining > 0) {
        initial[it.id] = String(remaining);
      }
    }
    setReceiveQty(initial);
    setReceiveOpen(true);
  };

  if (!poId) {
    return (
      <div className="p-6">
        <EmptyState title="Geçersiz bağlantı" description="Sipariş bulunamadı." />
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (detailQuery.isError || !po) {
    return (
      <div className="p-6">
        <EmptyState
          title="Sipariş yüklenemedi"
          description={getApiErrorMessage(detailQuery.error)}
          action={{
            label: 'Listeye dön',
            onClick: () => {
              void navigate('/purchase-orders');
            },
          }}
        />
      </div>
    );
  }

  const canSend = po.status === 'DRAFT';
  const canConfirm = po.status === 'SENT';
  const canCancel =
    po.status !== 'CANCELLED' &&
    po.status !== 'RECEIVED' &&
    !po.items.some((i) => i.receivedQty > 0);
  const canReceive =
    po.status === 'SENT' ||
    po.status === 'CONFIRMED' ||
    po.status === 'PARTIALLY_RECEIVED';

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/purchase-orders">
            <ArrowLeft className="mr-1 size-4" />
            Listeye dön
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-semibold">{po.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            <Link to={`/suppliers/${po.supplierId}`} className="text-sky-600 hover:underline">
              {po.supplier.name}
            </Link>
            {' · '}
            {formatSupplierDate(po.createdAt)}
          </p>
        </div>
        <Badge variant="outline" className={poStatusBadgeClass(po.status)}>
          {PO_STATUS_LABEL_TR[po.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Durum akışı</CardTitle>
        </CardHeader>
        <CardContent>
          {po.status === 'CANCELLED' ? (
            <p className="text-sm text-destructive">Bu sipariş iptal edildi.</p>
          ) : (
            <ol className="flex flex-wrap gap-2 sm:gap-0 sm:justify-between">
              {TIMELINE_STEPS.map((step, idx) => {
                const done = idx <= currentStep;
                const active = idx === currentStep;
                return (
                  <li
                    key={step.status}
                    className={cn(
                      'flex flex-1 min-w-[88px] flex-col items-center gap-1 text-center text-xs',
                      done ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-full border-2 text-[10px] font-semibold',
                        done
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-muted bg-background',
                        active && 'ring-2 ring-sky-200',
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span>{step.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {canSend ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (window.confirm('Taslak tedarikçiye gönderilsin mi?')) {
                sendMutation.mutate();
              }
            }}
            disabled={sendMutation.isPending}
          >
            <Send className="mr-1 size-4" />
            Gönder
          </Button>
        ) : null}
        {canConfirm ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
          >
            <Check className="mr-1 size-4" />
            Onayla
          </Button>
        ) : null}
        {canReceive ? (
          <Button type="button" size="sm" onClick={openReceiveDialog}>
            <PackageCheck className="mr-1 size-4" />
            Mal teslim al
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => {
              if (window.confirm('Sipariş iptal edilsin mi?')) {
                cancelMutation.mutate();
              }
            }}
            disabled={cancelMutation.isPending}
          >
            <Trash2 className="mr-1 size-4" />
            İptal et
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pdfLoading}
          onClick={() => {
            setPdfLoading(true);
            void downloadPoPdf(poId, po.orderNumber)
              .then(() => toast.success('PDF indirildi.'))
              .catch((e: unknown) => toast.error(getApiErrorMessage(e)))
              .finally(() => setPdfLoading(false));
          }}
        >
          {pdfLoading ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <FileText className="mr-1 size-4" />
          )}
          PDF indir
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Toplam tutar</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {formatTryAmount(po.totalAmount)} {po.currency}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Beklenen tarih</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {po.expectedDate ? formatSupplierDate(po.expectedDate) : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Teslim</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {po.receivedAt
              ? new Date(po.receivedAt).toLocaleString('tr-TR')
              : 'Henüz teslim alınmadı'}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notlar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => {
              setNotesDirty(true);
              setNotes(e.target.value);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={saveNotesMutation.isPending}
            onClick={() => saveNotesMutation.mutate()}
          >
            Notu kaydet
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Ürün listesi</h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Sipariş</TableHead>
                <TableHead className="text-right">Teslim alınan</TableHead>
                <TableHead className="text-right">Birim fiyat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((it: PurchaseOrderItemDto) => (
                <TableRow key={it.id}>
                  <TableCell>{it.productName}</TableCell>
                  <TableCell className="font-mono text-sm">{it.barcode}</TableCell>
                  <TableCell className="text-right tabular-nums">{it.orderedQty}</TableCell>
                  <TableCell className="text-right tabular-nums">{it.receivedQty}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatTryAmount(it.unitCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mal teslim al</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Her ürün için bu seferde teslim alınacak miktarı girin. Stok ana depoda artırılır.
          </p>
          <div className="space-y-3 py-2">
            {po.items.map((it) => {
              const remaining = it.orderedQty - it.receivedQty;
              if (remaining <= 0) {
                return null;
              }
              return (
                <div key={it.id} className="space-y-1 rounded-md border p-3">
                  <div className="text-sm font-medium">{it.productName}</div>
                  <div className="font-mono text-xs text-muted-foreground">{it.barcode}</div>
                  <p className="text-xs text-muted-foreground">
                    Kalan: <strong>{remaining}</strong> ad.
                  </p>
                  <Label className="text-xs">Teslim alınan miktar</Label>
                  <Input
                    type="number"
                    min={1}
                    max={remaining}
                    value={receiveQty[it.id] ?? ''}
                    onChange={(e) =>
                      setReceiveQty((m) => ({ ...m, [it.id]: e.target.value }))
                    }
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceiveOpen(false)}>
              <X className="mr-1 size-4" />
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={receiveMutation.isPending}
              onClick={handleReceiveSubmit}
            >
              {receiveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <PackageCheck className="mr-1 size-4" />
                  Kaydet
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
