import type { ReactElement, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
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

function metadataString(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  if (typeof v === 'string' && v.length > 0) {
    return v;
  }
  return '—';
}

function syncRowStatus(entry: AuditLogEntry): string {
  const meta = entry.metadata ?? {};
  const s = metadataString(meta, 'status');
  if (s !== '—') {
    return s;
  }
  const ok = meta.ok;
  if (typeof ok === 'boolean') {
    return ok ? 'Başarılı' : 'Başarısız';
  }
  return '—';
}

export function SyncLogsPage(): ReactElement {
  const queryClient = useQueryClient();

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
        params: { limit: 50, action: 'sync_*' },
      });
      return data;
    },
  });

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Sync durumu</h1>
          <p className="text-muted-foreground">
            Pazaryeri bağlantılarınızın sağlığı ve son senkronizasyon denetim kayıtları.
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
        <h2 className="text-lg font-semibold">Son sync işlemleri</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Denetim kaydı</CardTitle>
            <CardDescription>
              Son 50 kayıt (<code className="text-xs">sync_*</code> ile başlayan işlemler).
            </CardDescription>
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
                      <TableHead>Platform</TableHead>
                      <TableHead>İşlem</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(auditQuery.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                          Henüz sync ile ilgili denetim kaydı yok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (auditQuery.data ?? []).map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">{syncRowPlatform(entry)}</TableCell>
                          <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                          <TableCell className="text-sm">{syncRowStatus(entry)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.createdAt), {
                              addSuffix: true,
                              locale: tr,
                            })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
