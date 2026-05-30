import type { ReactElement } from 'react';
import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

import { resolveSettingsProductAccess } from './settings-tabs.config';
import { SettingsIntegrationUpgrade } from './SettingsIntegrationUpgrade';
import {
  deliveryStatusLabel,
  endpointStatusLabel,
  formatWebhookDate,
  WEBHOOK_EVENTS,
  type WebhookDeliveryLogsResponse,
  type WebhookDeliveryRow,
  type WebhookEndpointRow,
} from './webhooks.constants';

export function WebhookDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();
  const { accountingOnly } = resolveSettingsProductAccess(orgProducts);

  const endpointQuery = useQuery({
    queryKey: ['webhook-endpoint', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<WebhookEndpointRow> => {
      const { data } = await api.get<WebhookEndpointRow[]>('webhooks');
      const row = data.find((r) => r.id === id);
      if (!row) {
        throw new Error('Webhook uç noktası bulunamadı');
      }
      return row;
    },
  });

  const logsQuery = useQuery({
    queryKey: ['webhook-logs', id, page],
    enabled: Boolean(id),
    queryFn: async (): Promise<WebhookDeliveryLogsResponse> => {
      const { data } = await api.get<WebhookDeliveryLogsResponse>(`webhooks/${id}/deliveries`, {
        params: { page, limit: 100 },
      });
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<Pick<WebhookEndpointRow, 'url' | 'events' | 'isActive'>>) => {
      await api.patch(`webhooks/${id}`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoint', id] });
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Endpoint güncellendi');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const testMutation = useMutation({
    mutationFn: async (): Promise<WebhookDeliveryRow> => {
      const { data } = await api.post<WebhookDeliveryRow>(`webhooks/${id}/test`);
      return data;
    },
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-logs', id] });
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoint', id] });
      const ok = delivery.status === 'SUCCESS';
      toast[ok ? 'success' : 'error'](
        ok
          ? `Test başarılı (${delivery.statusCode ?? '—'}, ${delivery.duration ?? '—'} ms)`
          : `Test başarısız (${delivery.statusCode ?? '—'}, ${delivery.duration ?? '—'} ms)`,
      );
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const redeliverMutation = useMutation({
    mutationFn: async (logId: string): Promise<void> => {
      await api.post(`webhooks/${id}/redeliver/${logId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-logs', id] });
      toast.success('Teslimat yeniden kuyruğa alındı');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const endpoint = endpointQuery.data;
  usePageTitle(endpoint?.name ?? 'Webhook');
  const selectedEvents = useMemo(
    () => new Set(endpoint?.events ?? []),
    [endpoint?.events],
  );

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, (typeof WEBHOOK_EVENTS)[number][]>();
    for (const ev of WEBHOOK_EVENTS) {
      const list = groups.get(ev.group) ?? [];
      list.push(ev);
      groups.set(ev.group, list);
    }
    return [...groups.entries()];
  }, []);

  const toggleSubscription = (eventId: string, checked: boolean): void => {
    if (!endpoint) {
      return;
    }
    const next = new Set(endpoint.events);
    if (checked) {
      next.add(eventId);
    } else {
      next.delete(eventId);
    }
    if (next.size === 0) {
      toast.error('En az bir olay seçilmelidir');
      return;
    }
    updateMutation.mutate({ events: [...next] });
  };

  if (accountingOnly) {
    return (
      <div className="space-y-6">
        <SettingsIntegrationUpgrade
          showNativeAccountingCta={
            accountingMode === 'NATIVE' && !accountingModeLoading
          }
        />
      </div>
    );
  }

  if (!id) {
    return <p className="text-sm text-destructive">Geçersiz endpoint.</p>;
  }

  if (endpointQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (endpointQuery.isError || !endpoint) {
    return (
      <div className="space-y-4">
        <QueryErrorAlert
          error={endpointQuery.error ?? new Error('Endpoint yüklenemedi.')}
          onRetry={
            endpointQuery.isError
              ? () => {
                  void endpointQuery.refetch();
                }
              : undefined
          }
        />
        <Button type="button" variant="outline" asChild>
          <Link to="/settings/webhooks">Listeye dön</Link>
        </Button>
      </div>
    );
  }

  const totalPages = logsQuery.data
    ? Math.max(1, Math.ceil(logsQuery.data.total / logsQuery.data.limit))
    : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title={endpoint.url}
        description={endpoint.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                endpoint.status === 'DISABLED' || !endpoint.isActive
                  ? 'destructive'
                  : 'default'
              }
            >
              {endpointStatusLabel(endpoint.status, endpoint.isActive)}
            </Badge>
            <Button
              type="button"
              variant="outline"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              Test event gönder
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/settings/webhooks">
                <ArrowLeft className="mr-2 size-4" aria-hidden />
                Webhook&apos;lara dön
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint ayarları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Aktif</Label>
              <p className="text-sm text-muted-foreground">Pasif endpoint olay almaz.</p>
            </div>
            <Switch
              checked={endpoint.isActive}
              disabled={updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ isActive: checked })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endpoint-url">URL</Label>
            <div className="flex gap-2">
              <Input
                id="endpoint-url"
                defaultValue={endpoint.url}
                key={endpoint.updatedAt}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== endpoint.url) {
                    updateMutation.mutate({ url: next });
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Olay abonelikleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedEvents.map(([group, events]) => (
            <div key={group} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {events.map((ev) => (
                  <label
                    key={ev.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2"
                  >
                    <Checkbox
                      checked={selectedEvents.has(ev.id)}
                      disabled={updateMutation.isPending}
                      onCheckedChange={(v) => toggleSubscription(ev.id, v === true)}
                    />
                    <span className="text-sm">{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Teslimat logları</CardTitle>
          {logsQuery.data ? (
            <span className="text-sm text-muted-foreground">
              Toplam {logsQuery.data.total} kayıt
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : logsQuery.isError ? (
            <QueryErrorAlert
              error={logsQuery.error}
              onRetry={() => {
                void logsQuery.refetch();
              }}
            />
          ) : !logsQuery.data?.data.length ? (
            <p className="text-sm text-muted-foreground">Henüz teslimat kaydı yok.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Olay</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Süre</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsQuery.data.data.map((log) => (
                    <Fragment key={log.id}>
                      <TableRow>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatWebhookDate(log.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.event}</TableCell>
                        <TableCell>{log.statusCode ?? '—'}</TableCell>
                        <TableCell>{log.duration != null ? `${log.duration} ms` : '—'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={log.status === 'SUCCESS' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {deliveryStatusLabel(log.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedLogId((cur) => (cur === log.id ? null : log.id))}
                          >
                            {expandedLogId === log.id ? 'Gizle' : 'Yanıt'}
                          </Button>
                          {log.status === 'FAILED' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={redeliverMutation.isPending}
                              onClick={() => redeliverMutation.mutate(log.id)}
                            >
                              Tekrar dene
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                      {expandedLogId === log.id ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/40">
                            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                              {log.responseBody && log.responseBody.length > 0
                                ? log.responseBody
                                : '(Gövde yok)'}
                            </pre>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Önceki
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Sayfa {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sonraki
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
