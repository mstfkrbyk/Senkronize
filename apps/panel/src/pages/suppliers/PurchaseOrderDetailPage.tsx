import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Loader2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { PurchaseOrderDetailDto, PurchaseOrderItemDto } from '@/types/supply';

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadDetailCsv(po: PurchaseOrderDetailDto): void {
  const headers = [
    'barkod',
    'urun',
    'siparis',
    'teslim_alinan',
    'birim_maliyet',
    'satir_tutari',
  ];
  const lines = [
    headers.join(','),
    ...po.items.map((i) =>
      [
        escapeCsvCell(i.barcode),
        escapeCsvCell(i.productName),
        escapeCsvCell(String(i.orderedQty)),
        escapeCsvCell(String(i.receivedQty)),
        escapeCsvCell(i.unitCost),
        escapeCsvCell(i.totalCost),
      ].join(','),
    ),
  ];
  const blob = new Blob([`\ufeff${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${po.orderNumber}-kalemler.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PurchaseOrderDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const poId = id ?? '';
  const queryClient = useQueryClient();
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

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
      toast.success('Tedarikçiye e-posta gönderildi (veya test modunda kayda alındı).');
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
    mutationFn: async (items: { barcode: string; quantity: number }[]): Promise<void> => {
      await api.post(`/purchase-orders/${poId}/receive`, { items });
    },
    onSuccess: async () => {
      toast.success('Teslim alındı, stok güncellendi.');
      setReceiveQty({});
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

  const handleReceive = (): void => {
    if (!po) {
      return;
    }
    const items: { barcode: string; quantity: number }[] = [];
    for (const it of po.items) {
      const raw = receiveQty[it.barcode]?.trim();
      if (!raw) {
        continue;
      }
      const q = Number.parseInt(raw, 10);
      if (Number.isFinite(q) && q > 0) {
        items.push({ barcode: it.barcode, quantity: q });
      }
    }
    if (items.length === 0) {
      toast.error('En az bir kalem için teslim miktarı girin.');
      return;
    }
    receiveMutation.mutate(items);
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
        <Button type="button" variant="outline" size="sm" onClick={() => downloadDetailCsv(po)}>
          <Download className="mr-1 size-4" />
          Kalemleri CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-semibold">{po.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">{po.supplier.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={poStatusBadgeClass(po.status)}>
            {PO_STATUS_LABEL_TR[po.status]}
          </Badge>
          {canSend ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (window.confirm('Taslak tedarikçiye e-posta ile gönderilsin mi?')) {
                  sendMutation.mutate();
                }
              }}
              disabled={sendMutation.isPending}
            >
              <Send className="mr-1 size-4" />
              Gönder
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
              İptal
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Toplam</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {po.totalAmount} {po.currency}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Beklenen tarih</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {po.expectedDate
              ? new Date(po.expectedDate).toLocaleDateString('tr-TR')
              : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Oluşturma</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {new Date(po.createdAt).toLocaleString('tr-TR')}
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
        <h2 className="mb-2 text-lg font-semibold">Kalemler</h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barkod</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Sipariş</TableHead>
                <TableHead className="text-right">Teslim</TableHead>
                <TableHead className="text-right">Birim</TableHead>
                <TableHead className="text-right">Satır</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((it: PurchaseOrderItemDto) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-sm">{it.barcode}</TableCell>
                    <TableCell>{it.productName}</TableCell>
                    <TableCell className="text-right tabular-nums">{it.orderedQty}</TableCell>
                    <TableCell className="text-right tabular-nums">{it.receivedQty}</TableCell>
                    <TableCell className="text-right tabular-nums">{it.unitCost}</TableCell>
                    <TableCell className="text-right tabular-nums">{it.totalCost}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {canReceive ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teslim al</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ana depoda merkezi stok (PURCHASE) olarak artırılır. Barkod başına bu seferde
              teslim alınacak miktarı girin.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {po.items.map((it) => {
                const remaining = it.orderedQty - it.receivedQty;
                if (remaining <= 0) {
                  return null;
                }
                return (
                  <div key={it.id} className="space-y-1 rounded-md border p-3">
                    <div className="text-sm font-medium">{it.productName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{it.barcode}</div>
                    <div className="text-xs text-muted-foreground">
                      Kalan: <strong>{remaining}</strong> ad.
                    </div>
                    <Label className="text-xs">Teslim (adet)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={remaining}
                      placeholder="0"
                      value={receiveQty[it.barcode] ?? ''}
                      onChange={(e) =>
                        setReceiveQty((m) => ({ ...m, [it.barcode]: e.target.value }))
                      }
                    />
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              disabled={receiveMutation.isPending}
              onClick={handleReceive}
            >
              {receiveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Teslimi kaydet'
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
