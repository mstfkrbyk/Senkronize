import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBreadcrumbTail } from '@/hooks/useBreadcrumbTail';
import {
  useErpSyncSettings,
  useTriggerErpSyncNow,
  useUpsertErpSyncSettings,
  type ErpSyncFrequency,
  type ErpSyncSettingsDto,
} from '@/hooks/useErpSyncSettings';
import { useErpConnections } from '@/hooks/useErpConnections';
import { api, getApiErrorMessage } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getErpBranding } from '@/pages/connections/erp-display';
import type { SyncLogEntry, SyncLogStatus } from '@/types/sync-log';

const FREQUENCY_OPTIONS: { value: ErpSyncFrequency; label: string }[] = [
  { value: 'REALTIME', label: 'Anlık' },
  { value: 'EVERY_15_MIN', label: '15 dk' },
  { value: 'HOURLY', label: '1 saat' },
  { value: 'EVERY_4_HOURS', label: '4 saat' },
  { value: 'DAILY', label: 'Günlük' },
  { value: 'MANUAL', label: 'Manuel' },
];

const ERP_JOB_LABELS: Record<string, string> = {
  products: 'Ürünler',
  stock: 'Stok',
  invoices: 'Faturalar',
  orders: 'Siparişler',
};

function statusBadge(status: SyncLogStatus): ReactElement {
  const map: Record<
    SyncLogStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    RUNNING: { label: 'Çalışıyor', variant: 'secondary' },
    SUCCESS: { label: 'Başarılı', variant: 'default' },
    PARTIAL: { label: 'Kısmi', variant: 'outline' },
    FAILED: { label: 'Başarısız', variant: 'destructive' },
  };
  const c = map[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function erpJobLabel(jobType: string): string {
  const parts = jobType.split(':');
  const type = parts.length >= 3 ? parts[2] : jobType;
  return ERP_JOB_LABELS[type] ?? type;
}

function formatDuration(ms: number | null): string {
  if (ms === null) {
    return '—';
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const sec = Math.round(ms / 1000);
  if (sec < 60) {
    return `${sec} sn`;
  }
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min} dk ${rem} sn` : `${min} dk`;
}

function connectionStatusBadge(isActive: boolean, syncErrorCount: number): ReactElement {
  if (!isActive) {
    return (
      <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
        Pasif
      </Badge>
    );
  }
  if (syncErrorCount >= 3) {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">
        Hata
      </Badge>
    );
  }
  if (syncErrorCount > 0) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
        Uyarı
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
      Aktif
    </Badge>
  );
}

function settingsToForm(settings: ErpSyncSettingsDto): {
  syncFrequency: ErpSyncFrequency;
  syncStock: boolean;
  syncProducts: boolean;
  syncInvoices: boolean;
} {
  return {
    syncFrequency: settings.syncFrequency,
    syncStock: settings.syncStock,
    syncProducts: settings.syncProducts,
    syncInvoices: settings.syncInvoices,
  };
}

export function ErpConnectionDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const connectionId = id ?? null;

  const connectionsQuery = useErpConnections();
  const settingsQuery = useErpSyncSettings(connectionId);
  const saveSettings = useUpsertErpSyncSettings(connectionId ?? '');
  const syncNow = useTriggerErpSyncNow(connectionId ?? '');

  const connection = connectionsQuery.data?.find((c) => c.id === connectionId);
  const branding = connection ? getErpBranding(connection.erpType) : null;
  const pageTitle = branding ? `${branding.label} — ERP` : 'ERP bağlantısı';

  usePageTitle(pageTitle);
  useBreadcrumbTail(pageTitle);

  const [form, setForm] = useState({
    syncFrequency: 'HOURLY' as ErpSyncFrequency,
    syncStock: true,
    syncProducts: true,
    syncInvoices: false,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsToForm(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const logsQuery = useQuery({
    queryKey: ['erp-sync-logs', connectionId],
    enabled: connectionId !== null,
    queryFn: async (): Promise<SyncLogEntry[]> => {
      const params = new URLSearchParams({
        jobTypeStartsWith: `erp:${connectionId}:`,
        limit: '10',
      });
      const { data } = await api.get<{ data: SyncLogEntry[] }>(
        `/sync/logs?${params.toString()}`,
      );
      return data.data;
    },
  });

  const handleSave = (): void => {
    if (!connectionId) {
      return;
    }
    saveSettings.mutate(form, {
      onSuccess: () => {
        toast.success('Senkron ayarları kaydedildi.');
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  const handleSyncNow = (): void => {
    syncNow.mutate(undefined, {
      onSuccess: () => {
        toast.success('Senkron işleri kuyruğa alındı.');
        void logsQuery.refetch();
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  if (connectionsQuery.isLoading || settingsQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (connectionsQuery.isError) {
    return (
      <div className="p-6 text-sm text-destructive">
        {getApiErrorMessage(connectionsQuery.error)}
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">ERP bağlantısı bulunamadı.</p>
        <Button variant="outline" asChild>
          <Link to="/connections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Bağlantılara dön
          </Link>
        </Button>
      </div>
    );
  }

  const lastSyncLabel =
    connection.lastSyncAt !== null
      ? formatDistanceToNow(new Date(connection.lastSyncAt), {
          addSuffix: true,
          locale: tr,
        })
      : 'Henüz senkron yok';

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/connections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Bağlantılar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span aria-hidden>{branding?.logo}</span>
                {branding?.label}
              </CardTitle>
              <CardDescription className="mt-1">
                {branding?.accountFieldLabel}: {connection.accountLabel ?? '—'}
              </CardDescription>
            </div>
            {connectionStatusBadge(connection.isActive, connection.syncErrorCount)}
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Son senkron: {lastSyncLabel}</p>
          {settingsQuery.data?.nextSyncAt && settingsQuery.data.syncFrequency !== 'MANUAL' ? (
            <p className="mt-1">
              Sonraki planlı senkron:{' '}
              {format(new Date(settingsQuery.data.nextSyncAt), 'd MMM yyyy HH:mm', {
                locale: tr,
              })}
            </p>
          ) : null}
          {connection.lastErrorMessage ? (
            <p className="mt-2 rounded-md border border-red-100 bg-red-50 px-2 py-1.5 text-xs text-red-800">
              {connection.lastErrorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Senkron ayarları</CardTitle>
          <CardDescription>
            ERP verilerinin ne sıklıkla ve hangi türlerde senkronize edileceğini belirleyin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Sıklık</Label>
            <div
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
              role="radiogroup"
              aria-label="Senkron sıklığı"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={form.syncFrequency === opt.value}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    form.syncFrequency === opt.value
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-primary/40'
                  }`}
                  onClick={() => {
                    setForm((f) => ({ ...f, syncFrequency: opt.value }));
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label>Veri türleri</Label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Stok</p>
                <p className="text-xs text-muted-foreground">Stok seviyelerini senkronize et</p>
              </div>
              <Switch
                checked={form.syncStock}
                onCheckedChange={(v) => {
                  setForm((f) => ({ ...f, syncStock: v }));
                }}
                aria-label="Stok senkronu"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Ürün</p>
                <p className="text-xs text-muted-foreground">Ürün kartlarını senkronize et</p>
              </div>
              <Switch
                checked={form.syncProducts}
                onCheckedChange={(v) => {
                  setForm((f) => ({ ...f, syncProducts: v }));
                }}
                aria-label="Ürün senkronu"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Fatura</p>
                <p className="text-xs text-muted-foreground">Fatura verilerini senkronize et</p>
              </div>
              <Switch
                checked={form.syncInvoices}
                onCheckedChange={(v) => {
                  setForm((f) => ({ ...f, syncInvoices: v }));
                }}
                aria-label="Fatura senkronu"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={saveSettings.isPending}
              onClick={() => {
                handleSave();
              }}
            >
              {saveSettings.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={syncNow.isPending || !connection.isActive}
              onClick={() => {
                handleSyncNow();
              }}
            >
              {syncNow.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kuyruğa alınıyor…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Şimdi Sync Et
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Son senkron kayıtları</CardTitle>
          <CardDescription>Bu bağlantı için son 10 senkron işlemi</CardDescription>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kayıtlar yükleniyor…
            </div>
          ) : null}
          {logsQuery.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(logsQuery.error)}</p>
          ) : null}
          {!logsQuery.isLoading && !logsQuery.isError && (logsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz senkron kaydı yok.</p>
          ) : null}
          {(logsQuery.data?.length ?? 0) > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tür</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlenen</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead>Başlangıç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsQuery.data?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{erpJobLabel(log.jobType)}</TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell>
                      {log.itemsProcessed}
                      {log.itemsFailed > 0 ? ` / ${log.itemsFailed} hata` : ''}
                    </TableCell>
                    <TableCell>{formatDuration(log.durationMs)}</TableCell>
                    <TableCell>
                      {format(new Date(log.startedAt), 'd MMM yyyy HH:mm', { locale: tr })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
