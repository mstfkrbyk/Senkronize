import type { ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AuditLogEntry } from '@/types/audit-log';

interface SyncHealthRow {
  organizationId: string;
  platform: string;
  lastSuccessAt: string | null;
  errorCount: number;
  status: 'healthy' | 'warning' | 'error';
}

type RowStatus = 'SUCCESS' | 'ERROR' | 'PENDING';
type OperationFilter =
  | 'all'
  | 'order_pull'
  | 'stock_push'
  | 'price_push'
  | 'listing_pull';

function statusBadgeVariant(
  status: SyncHealthRow['status'],
): 'default' | 'secondary' | 'destructive' {
  if (status === 'healthy') {
    return 'default';
  }
  if (status === 'warning') {
    return 'secondary';
  }
  return 'destructive';
}

function statusLabel(status: SyncHealthRow['status']): string {
  if (status === 'healthy') {
    return 'Sağlıklı';
  }
  if (status === 'warning') {
    return 'Uyarı';
  }
  return 'Hata';
}

function syncRowPlatform(entry: AuditLogEntry): ReactNode {
  const p = entry.metadata?.platform;
  if (typeof p === 'string' && p.length > 0) {
    const branding = getMarketplaceBranding(p);
    return (
      <span className="flex items-center gap-2">
        {branding.logo}
        {branding.label}
      </span>
    );
  }
  return '—';
}

function entryOperation(entry: AuditLogEntry): OperationFilter | 'other' {
  const jn = entry.metadata?.jobName;
  if (jn === 'pull-orders') {
    return 'order_pull';
  }
  if (jn === 'push-stock') {
    return 'stock_push';
  }
  if (jn === 'push-price') {
    return 'price_push';
  }
  if (jn === 'pull-listings') {
    return 'listing_pull';
  }
  return 'other';
}

function entryRowStatus(entry: AuditLogEntry): RowStatus {
  if (entry.action === 'queue.job_failed') {
    return 'ERROR';
  }
  const meta = entry.metadata ?? {};
  const ok = meta.ok;
  if (typeof ok === 'boolean') {
    return ok ? 'SUCCESS' : 'ERROR';
  }
  const s = meta.status;
  if (s === 'ERROR' || s === 'FAILED' || s === 'failure') {
    return 'ERROR';
  }
  if (s === 'PENDING' || s === 'pending') {
    return 'PENDING';
  }
  if (s === 'SUCCESS' || s === 'success') {
    return 'SUCCESS';
  }
  return 'SUCCESS';
}

function rowStatusLabel(s: RowStatus): string {
  if (s === 'SUCCESS') {
    return 'Başarılı';
  }
  if (s === 'ERROR') {
    return 'Hata';
  }
  return 'Beklemede';
}

function rowStatusBadgeClass(s: RowStatus): string {
  if (s === 'SUCCESS') {
    return 'border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-50';
  }
  if (s === 'ERROR') {
    return 'border-red-600/30 bg-red-50 text-red-800 hover:bg-red-50';
  }
  return 'border-slate-400/40 bg-slate-100 text-slate-700 hover:bg-slate-100';
}

function operationLabel(op: OperationFilter | 'other'): string {
  switch (op) {
    case 'order_pull':
      return 'Sipariş çekme';
    case 'stock_push':
      return 'Stok gönderme';
    case 'price_push':
      return 'Fiyat gönderme';
    case 'listing_pull':
      return 'Listeleme çekme';
    default:
      return 'Diğer';
  }
}

function formatDetailTime(iso: string): string {
  try {
    return format(new Date(iso), 'dd.MM.yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

function extractErrorDetail(entry: AuditLogEntry): string {
  const meta = entry.metadata ?? {};
  const fr = meta.failedReason;
  if (typeof fr === 'string' && fr.length > 0) {
    return fr;
  }
  const msg = meta.message ?? meta.error;
  if (typeof msg === 'string') {
    return msg;
  }
  return '—';
}

export function SyncLogsPage(): ReactElement {
  const queryClient = useQueryClient();
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [operationFilter, setOperationFilter] = useState<OperationFilter>('all');
  const [detailEntry, setDetailEntry] = useState<AuditLogEntry | null>(null);

  const statusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: async (): Promise<SyncHealthRow[]> => {
      const { data } = await api.get<SyncHealthRow[]>('/sync/status');
      return data;
    },
  });

  const auditQuery = useQuery({
    queryKey: ['audit-log', 'sync'],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data } = await api.get<AuditLogEntry[]>('/audit-log', {
        params: { limit: 100, syncOnly: true },
      });
      return data;
    },
  });

  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of auditQuery.data ?? []) {
      const p = e.metadata?.platform;
      if (typeof p === 'string' && p.length > 0) {
        set.add(p);
      }
    }
    return [...set].sort();
  }, [auditQuery.data]);

  const filteredRows = useMemo(() => {
    let rows = [...(auditQuery.data ?? [])];
    if (platformFilter !== 'all') {
      rows = rows.filter((e) => e.metadata?.platform === platformFilter);
    }
    if (operationFilter !== 'all') {
      rows = rows.filter((e) => entryOperation(e) === operationFilter);
    }
    return rows;
  }, [auditQuery.data, platformFilter, operationFilter]);

  const syncMutation = useMutation({
    mutationFn: async (): Promise<{ jobIds: string[]; message: string }> => {
      const { data } = await api.post<{ jobIds: string[]; message: string }>(
        '/listings/sync',
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-log', 'sync'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (auditLogId: string): Promise<{ jobId: string }> => {
      const { data } = await api.post<{ jobId: string }>('/listings/retry-job', {
        auditLogId,
      });
      return data;
    },
    onSuccess: () => {
      toast.success('İş yeniden kuyruğa alındı');
      void queryClient.invalidateQueries({ queryKey: ['audit-log', 'sync'] });
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const canRetry = (entry: AuditLogEntry): boolean => {
    if (entryRowStatus(entry) !== 'ERROR') {
      return false;
    }
    const jn = entry.metadata?.jobName;
    return (
      jn === 'pull-orders' ||
      jn === 'pull-listings' ||
      jn === 'push-stock' ||
      jn === 'push-price'
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Sync durumu</h1>
          <p className="text-muted-foreground">
            Pazaryeri bağlantılarınızın sağlığı ve senkronizasyon denetim kayıtları.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          Manuel sync
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Platform sağlığı</h2>
        {statusQuery.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(statusQuery.error)}</p>
        ) : null}
        {statusQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        ) : (statusQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aktif pazaryeri bağlantısı yok veya henüz kayıt oluşmadı.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(statusQuery.data ?? []).map((row) => {
              const branding = getMarketplaceBranding(row.platform);
              return (
                <Card key={row.platform}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      {branding.logo}
                      <CardTitle className="text-base font-medium">{branding.label}</CardTitle>
                    </div>
                    <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      Son başarı:{' '}
                      {row.lastSuccessAt
                        ? formatDistanceToNow(new Date(row.lastSuccessAt), {
                            addSuffix: true,
                            locale: tr,
                          })
                        : '—'}
                    </p>
                    <p>Hata sayısı: {row.errorCount}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Senkronizasyon günlüğü</h2>
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">Denetim kaydı</CardTitle>
              <CardDescription>
                Son kayıtlar (sync işlemleri ve ilgili kuyruk hataları). Filtreler yalnızca bu
                sayfadaki listeyi daraltır.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Platform</Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {platformOptions.map((p) => {
                      const b = getMarketplaceBranding(p);
                      return (
                        <SelectItem key={p} value={p}>
                          {b.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">İşlem</Label>
                <Select
                  value={operationFilter}
                  onValueChange={(v) => setOperationFilter(v as OperationFilter)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="İşlem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="order_pull">{operationLabel('order_pull')}</SelectItem>
                    <SelectItem value="stock_push">{operationLabel('stock_push')}</SelectItem>
                    <SelectItem value="price_push">{operationLabel('price_push')}</SelectItem>
                    <SelectItem value="listing_pull">{operationLabel('listing_pull')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {auditQuery.isError ? (
              <p className="text-sm text-destructive">{getApiErrorMessage(auditQuery.error)}</p>
            ) : null}
            {auditQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zaman</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>İşlem</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">Detay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          Kayıt bulunamadı.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((entry) => {
                        const rs = entryRowStatus(entry);
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {formatDetailTime(entry.createdAt)}
                            </TableCell>
                            <TableCell className="text-sm">{syncRowPlatform(entry)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {typeof entry.metadata?.jobName === 'string'
                                ? entry.metadata.jobName
                                : entry.action}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={rowStatusBadgeClass(rs)}>
                                {rowStatusLabel(rs)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {canRetry(entry) ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={retryMutation.isPending}
                                    onClick={() => retryMutation.mutate(entry.id)}
                                  >
                                    Yeniden dene
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDetailEntry(entry)}
                                >
                                  Detay
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Sheet open={detailEntry !== null} onOpenChange={(o) => !o && setDetailEntry(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Denetim kaydı detayı</SheetTitle>
            <SheetDescription>
              {detailEntry ? formatDetailTime(detailEntry.createdAt) : ''} —{' '}
              {detailEntry?.action}
            </SheetDescription>
          </SheetHeader>
          {detailEntry ? (
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">Özet hata</p>
                <p className="mt-1 rounded-md border bg-muted/40 p-2 text-muted-foreground">
                  {extractErrorDetail(detailEntry)}
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Ham metadata</p>
                <pre className="mt-1 max-h-[50vh] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(detailEntry.metadata, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
