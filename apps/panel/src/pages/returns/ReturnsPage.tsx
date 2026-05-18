import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Undo2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ProductImage } from '@/components/ProductImage';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useMarketplaceConnections } from '@/hooks/useConnections';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { ReturnDetail, ReturnListItem, ReturnStatus } from '@/types/return';

const STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Talep edildi',
  APPROVED: 'Onaylandı',
  IN_TRANSIT: 'Yolda',
  RECEIVED: 'Teslim alındı',
  REFUNDED: 'İade edildi',
  REJECTED: 'Reddedildi',
  COMPLETED: 'Tamamlandı',
};

function statusBadgeClass(status: ReturnStatus): string {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'border-green-200 bg-green-50 text-green-900';
    case 'REFUNDED':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'REJECTED':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    case 'IN_TRANSIT':
    case 'RECEIVED':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    default:
      return 'border-muted bg-muted/40 text-foreground';
  }
}

function formatTry(amount: string | null, currency: string): string {
  if (!amount) {
    return '—';
  }
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(Number(amount));
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ReturnsPage(): ReactElement {
  usePageTitle('İadeler');
  const queryClient = useQueryClient();
  const connectionsQuery = useMarketplaceConnections();

  const [platform, setPlatform] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReturnListItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [syncConnectionId, setSyncConnectionId] = useState('');

  const limit = 20;

  const listQuery = useQuery({
    queryKey: [
      'returns',
      { platform, status, startDate, endDate, page, limit },
    ],
    queryFn: async (): Promise<{ items: ReturnListItem[]; total: number }> => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (platform) {
        params.set('platform', platform);
      }
      if (status) {
        params.set('status', status);
      }
      if (startDate) {
        params.set('startDate', startDate);
      }
      if (endDate) {
        params.set('endDate', endDate);
      }
      const { data } = await api.get<{ items: ReturnListItem[]; total: number }>(
        `/returns?${params.toString()}`,
      );
      return data;
    },
  });

  const detailQuery = useQuery({
    queryKey: ['returns', 'detail', selected?.id],
    queryFn: async (): Promise<ReturnDetail> => {
      const { data } = await api.get<ReturnDetail>(`/returns/${selected?.id ?? ''}`);
      return data;
    },
    enabled: sheetOpen && !!selected?.id,
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: string): Promise<{ jobId: string }> => {
      const { data } = await api.post<{ jobId: string }>('/returns/sync', {
        connectionId,
      });
      return data;
    },
    onSuccess: (res) => {
      toast.success('İade senkronizasyonu kuyruğa alındı', {
        description: `İş no: ${res.jobId}`,
      });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.patch(`/returns/${id}/approve`);
    },
    onSuccess: async () => {
      toast.success('İade onaylandı');
      await queryClient.invalidateQueries({ queryKey: ['returns'] });
      void detailQuery.refetch();
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (args: { id: string; reason: string }): Promise<void> => {
      await api.patch(`/returns/${args.id}/reject`, { reason: args.reason });
    },
    onSuccess: async () => {
      toast.success('İade reddedildi');
      setRejectNote('');
      await queryClient.invalidateQueries({ queryKey: ['returns'] });
      void detailQuery.refetch();
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const activeConnections = useMemo(
    () => (connectionsQuery.data ?? []).filter((c) => c.isActive),
    [connectionsQuery.data],
  );

  const display = detailQuery.data ?? null;
  const canApproveReject =
    display &&
    !['REJECTED', 'REFUNDED', 'COMPLETED'].includes(display.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">İade yönetimi</h1>
          <p className="text-muted-foreground">
            Pazaryeri iadelerini görüntüleyin, onaylayın veya reddedin.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] space-y-1">
            <Label htmlFor="sync-conn">Bağlantı</Label>
            <Select
              value={syncConnectionId}
              onValueChange={setSyncConnectionId}
            >
              <SelectTrigger id="sync-conn">
                <SelectValue placeholder="Senkron için bağlantı" />
              </SelectTrigger>
              <SelectContent>
                {activeConnections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {getMarketplaceBranding(c.platform).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={!syncConnectionId || syncMutation.isPending}
            onClick={() => {
              if (syncConnectionId) {
                syncMutation.mutate(syncConnectionId);
              }
            }}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            )}
            Platformdan çek
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <Label>Platform</Label>
          <Select
            value={platform || '__all__'}
            onValueChange={(v) => {
              setPlatform(v === '__all__' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tümü</SelectItem>
              {activeConnections.map((c) => (
                <SelectItem key={c.platform} value={c.platform}>
                  {getMarketplaceBranding(c.platform).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Durum</Label>
          <Select
            value={status || '__all__'}
            onValueChange={(v) => {
              setStatus(v === '__all__' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tümü</SelectItem>
              {(Object.keys(STATUS_LABEL) as ReturnStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="start">Başlangıç</Label>
          <Input
            id="start"
            type="date"
            className="w-[160px]"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="end">Bitiş</Label>
          <Input
            id="end"
            type="date"
            className="w-[160px]"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {listQuery.isPending ? (
        <TableSkeleton rows={8} cols={7} />
      ) : listQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(listQuery.error)}
        </div>
      ) : (listQuery.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          iconNode={<Undo2 className="h-12 w-12 text-muted-foreground" aria-hidden />}
          title="Henüz iade yok"
          description="Senkron ile pazaryerinden iade kayıtlarını çekebilirsiniz."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Sipariş</TableHead>
                <TableHead>Ürünler</TableHead>
                <TableHead>Neden</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.data?.items.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(row);
                    setSheetOpen(true);
                  }}
                >
                  <TableCell>
                    <span className="flex items-center justify-center">
                      {getMarketplaceBranding(row.platform).logo}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.order.platformOrderId}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {row.items.slice(0, 3).map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center gap-1 rounded border bg-muted/30 px-1 py-0.5"
                          title={it.productName ?? it.barcode}
                        >
                          {it.thumbnailUrl ? (
                            <ProductImage
                              src={it.thumbnailUrl}
                              alt=""
                              size={28}
                              className="h-7 w-7 rounded"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                              —
                            </div>
                          )}
                          <span className="max-w-[72px] truncate text-xs">
                            {it.productName ?? it.barcode}
                          </span>
                        </div>
                      ))}
                      {row.items.length > 3 ? (
                        <span className="text-xs text-muted-foreground">
                          +{row.items.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                    {row.reason ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatTry(row.refundAmount, row.order.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(row.status)}
                    >
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(row.requestedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {listQuery.data && listQuery.data.total > limit ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Toplam {listQuery.data.total} kayıt · Sayfa {page} /{' '}
            {Math.max(1, Math.ceil(listQuery.data.total / limit))}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
              }}
            >
              Önceki
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page * limit >= listQuery.data.total}
              onClick={() => {
                setPage((p) => p + 1);
              }}
            >
              Sonraki
            </Button>
          </div>
        </div>
      ) : null}

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setSelected(null);
            setRejectNote('');
          }
        }}
      >
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              {selected ? (
                <span className="flex items-center gap-2">
                  {getMarketplaceBranding(selected.platform).logo}
                  İade detayı
                </span>
              ) : (
                'İade detayı'
              )}
            </SheetTitle>
            <SheetDescription>
              Sipariş ve iade kalemleri; durum geçmişi ve işlemler.
            </SheetDescription>
          </SheetHeader>

          {detailQuery.isPending ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : null}

          {display ? (
            <div className="mt-4 space-y-6">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium">Sipariş</p>
                <p className="mt-1 font-mono text-sm">
                  {display.order.platformOrderId}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Müşteri: {display.order.customerName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tutar:{' '}
                  <span className="font-semibold text-foreground">
                    {formatTry(display.order.totalAmount, display.order.currency)}
                  </span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Oluşturulma: {formatDateTime(display.order.platformCreatedAt)}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">İade kalemleri</p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12" />
                        <TableHead>Ürün</TableHead>
                        <TableHead className="text-right">Adet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {display.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell className="p-2">
                            {it.thumbnailUrl ? (
                              <ProductImage
                                src={it.thumbnailUrl}
                                alt=""
                                size={40}
                                className="h-10 w-10 rounded-md"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs">
                                —
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm">
                            {it.productName ?? it.barcode}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {it.quantity}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Durum geçmişi</p>
                <ul className="space-y-2 border-l-2 border-muted pl-4">
                  {[...display.statusLog]
                    .sort(
                      (a, b) =>
                        new Date(a.at).getTime() - new Date(b.at).getTime(),
                    )
                    .map((ev) => (
                      <li key={`${ev.at}-${ev.status}`} className="relative">
                        <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-sky-400" />
                        <p className="text-sm font-medium">
                          {STATUS_LABEL[ev.status as ReturnStatus] ?? ev.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(ev.at)}
                          {ev.note ? ` · ${ev.note}` : ''}
                        </p>
                      </li>
                    ))}
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reject-note">Red açıklaması</Label>
                <Textarea
                  id="reject-note"
                  placeholder="Red nedeni (platforma iletilir)"
                  value={rejectNote}
                  onChange={(e) => {
                    setRejectNote(e.target.value);
                  }}
                  rows={3}
                  disabled={!canApproveReject}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={
                    !canApproveReject || approveMutation.isPending
                  }
                  onClick={() => {
                    approveMutation.mutate(display.id);
                  }}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Onayla
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  disabled={
                    !canApproveReject ||
                    rejectMutation.isPending ||
                    rejectNote.trim().length === 0
                  }
                  onClick={() => {
                    rejectMutation.mutate({
                      id: display.id,
                      reason: rejectNote.trim(),
                    });
                  }}
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Reddet
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
