import type { ReactElement } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Play, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { api, getApiErrorMessage } from '@/lib/api';

import {
  deliveryStatusLabel,
  endpointStatusLabel,
  formatWebhookDate,
  WEBHOOK_EVENTS,
  type WebhookDeliveryLogsResponse,
  type WebhookDeliveryRow,
  type WebhookEndpointCreated,
  type WebhookEndpointRow,
} from '../webhooks.constants';
import { CreateWebhookModal } from './CreateWebhookModal';

const DELIVERY_LIMIT = 20;

interface Props {
  showHeader?: boolean;
  openCreateSignal?: number;
}

export function WebhooksPanel({ showHeader = true, openCreateSignal = 0 }: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpointRow | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(() => new Set(['order.created']));
  const [createdSecret, setCreatedSecret] = useState<WebhookEndpointCreated | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deliveriesEndpointId, setDeliveriesEndpointId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (openCreateSignal > 0) {
      setCreateOpen(true);
    }
  }, [openCreateSignal]);

  const endpointsQuery = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: async (): Promise<WebhookEndpointRow[]> => {
      const { data } = await api.get<WebhookEndpointRow[]>('webhooks');
      return data;
    },
  });

  const deliveriesQuery = useQuery({
    queryKey: ['webhook-deliveries', deliveriesEndpointId],
    enabled: Boolean(deliveriesEndpointId),
    queryFn: async (): Promise<WebhookDeliveryLogsResponse> => {
      const { data } = await api.get<WebhookDeliveryLogsResponse>(
        `webhooks/${deliveriesEndpointId}/deliveries`,
        { params: { page: 1, limit: DELIVERY_LIMIT } },
      );
      return data;
    },
  });

  const endpoints = endpointsQuery.data ?? [];

  const openEditDialog = (row: WebhookEndpointRow): void => {
    setEditingEndpoint(row);
    setFormName(row.name);
    setFormUrl(row.url);
    setSelectedEvents(new Set(row.events));
    setShowSecret(false);
    setRotatedSecret(null);
  };

  const closeEditDialog = (): void => {
    setEditingEndpoint(null);
  };

  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      url: string;
      events: string[];
      secret?: string;
    }): Promise<WebhookEndpointCreated> => {
      const { data } = await api.post<WebhookEndpointCreated>('webhooks', input);
      return data;
    },
    onSuccess: (data) => {
      setCreatedSecret(data);
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success(t('settings.webhooks.createSuccess'));
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!editingEndpoint) {
        return;
      }
      await api.patch(`webhooks/${editingEndpoint.id}`, {
        name: formName.trim(),
        url: formUrl.trim(),
        events: [...selectedEvents],
      });
    },
    onSuccess: () => {
      closeEditDialog();
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success(t('settings.webhooks.updateSuccess'));
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`webhooks/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success(t('settings.webhooks.deleteSuccess'));
      setDeleteId(null);
      setSelectedIds(new Set());
      if (deliveriesEndpointId) {
        setDeliveriesEndpointId(null);
      }
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const testMutation = useMutation({
    mutationFn: async (endpointId: string): Promise<WebhookDeliveryRow> => {
      const { data } = await api.post<WebhookDeliveryRow>(`webhooks/${endpointId}/test`);
      return data;
    },
    onSuccess: (delivery, endpointId) => {
      if (deliveriesEndpointId === endpointId) {
        void queryClient.invalidateQueries({
          queryKey: ['webhook-deliveries', endpointId],
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      const ok = delivery.status === 'SUCCESS';
      toast[ok ? 'success' : 'error'](
        ok
          ? t('settings.webhooks.testSuccess', {
              code: delivery.statusCode ?? '—',
              duration: delivery.duration ?? '—',
            })
          : t('settings.webhooks.testFailed', { code: delivery.statusCode ?? '—' }),
      );
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const rotateSecretMutation = useMutation({
    mutationFn: async (endpointId: string): Promise<WebhookEndpointCreated> => {
      const { data } = await api.post<WebhookEndpointCreated>(
        `webhooks/${endpointId}/rotate-secret`,
      );
      return data;
    },
    onSuccess: (data) => {
      setRotatedSecret(data.secret);
      setShowSecret(true);
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success(t('settings.webhooks.secretRotated'));
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const redeliverMutation = useMutation({
    mutationFn: async ({
      endpointId,
      deliveryId,
    }: {
      endpointId: string;
      deliveryId: string;
    }): Promise<void> => {
      await api.post(`webhooks/${endpointId}/redeliver/${deliveryId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] });
      toast.success(t('settings.webhooks.redeliverSuccess'));
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }): Promise<void> => {
      await api.patch(`webhooks/${id}`, { isActive });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async ({ ids, isActive }: { ids: string[]; isActive: boolean }): Promise<void> => {
      await Promise.all(ids.map((id) => api.patch(`webhooks/${id}`, { isActive })));
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success(
        variables.isActive
          ? t('settings.webhooks.bulkActivated')
          : t('settings.webhooks.bulkDeactivated'),
      );
      setSelectedIds(new Set());
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const toggleEvent = (id: string, checked: boolean): void => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      if (next.size === 0) {
        next.add(id);
      }
      return next;
    });
  };

  const toggleRowSelection = (id: string, checked: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean): void => {
    if (checked) {
      setSelectedIds(new Set(endpoints.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, (typeof WEBHOOK_EVENTS)[number][]>();
    for (const ev of WEBHOOK_EVENTS) {
      const list = groups.get(ev.group) ?? [];
      list.push(ev);
      groups.set(ev.group, list);
    }
    return [...groups.entries()];
  }, []);

  const deliveriesEndpoint = endpoints.find((r) => r.id === deliveriesEndpointId);
  const displaySecret = rotatedSecret ?? createdSecret?.secret ?? null;
  const allSelected = endpoints.length > 0 && selectedIds.size === endpoints.length;

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('settings.webhooks.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('settings.webhooks.subtitle')}</p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            {t('settings.webhooks.createButton')}
          </Button>
        </div>
      ) : null}

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
          <span className="text-sm text-muted-foreground">
            {t('settings.webhooks.selectedCount', { count: selectedIds.size })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkToggleMutation.isPending}
            onClick={() =>
              bulkToggleMutation.mutate({ ids: [...selectedIds], isActive: true })
            }
          >
            {t('settings.webhooks.bulkActivate')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkToggleMutation.isPending}
            onClick={() =>
              bulkToggleMutation.mutate({ ids: [...selectedIds], isActive: false })
            }
          >
            {t('settings.webhooks.bulkDeactivate')}
          </Button>
        </div>
      ) : null}

      {endpointsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : endpointsQuery.isError ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(endpointsQuery.error)}</p>
      ) : endpoints.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('settings.webhooks.empty')}</p>
      ) : (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => toggleSelectAll(v === true)}
                    aria-label={t('settings.webhooks.selectAll')}
                  />
                </TableHead>
                <TableHead>{t('settings.webhooks.colUrl')}</TableHead>
                <TableHead>{t('settings.webhooks.colEvents')}</TableHead>
                <TableHead>{t('settings.webhooks.colStatus')}</TableHead>
                <TableHead>{t('settings.webhooks.colLastTrigger')}</TableHead>
                <TableHead className="text-right">{t('settings.webhooks.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={(v) => toggleRowSelection(row.id, v === true)}
                      aria-label={row.name}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div
                      className="max-w-[220px] truncate text-xs text-muted-foreground"
                      title={row.url}
                    >
                      {row.url}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t('settings.webhooks.eventCount', { count: row.events.length })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.isActive && row.status === 'ACTIVE'}
                        disabled={toggleActiveMutation.isPending}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: row.id, isActive: checked })
                        }
                      />
                      <Badge
                        variant={
                          row.status === 'DISABLED' || !row.isActive ? 'secondary' : 'default'
                        }
                        className="text-xs"
                      >
                        {endpointStatusLabel(row.status, row.isActive)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.lastDeliveryStatus ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge
                          variant={row.lastDeliveryStatus === 'SUCCESS' ? 'default' : 'destructive'}
                          className="w-fit text-xs"
                        >
                          {deliveryStatusLabel(row.lastDeliveryStatus)}
                          {row.lastDeliveryStatusCode != null
                            ? ` · HTTP ${row.lastDeliveryStatusCode}`
                            : ''}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatWebhookDate(row.lastDeliveryAt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeliveriesEndpointId(row.id);
                          setExpandedLogId(null);
                        }}
                      >
                        {t('settings.webhooks.viewDeliveries')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={testMutation.isPending}
                        onClick={() => testMutation.mutate(row.id)}
                      >
                        <Play className="mr-1 size-3.5" />
                        {t('settings.webhooks.test')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(row)}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteId(row.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {deliveriesEndpointId && deliveriesEndpoint ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">{t('settings.webhooks.deliveryHistory')}</h3>
              <p className="text-sm text-muted-foreground">{deliveriesEndpoint.name}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeliveriesEndpointId(null)}
            >
              {t('common.close')}
            </Button>
          </div>
          {deliveriesQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : deliveriesQuery.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(deliveriesQuery.error)}</p>
          ) : !deliveriesQuery.data?.data.length ? (
            <p className="text-sm text-muted-foreground">{t('settings.webhooks.noDeliveries')}</p>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settings.webhooks.colDate')}</TableHead>
                    <TableHead>{t('settings.webhooks.colEvent')}</TableHead>
                    <TableHead>{t('settings.webhooks.colHttp')}</TableHead>
                    <TableHead>{t('settings.webhooks.colDuration')}</TableHead>
                    <TableHead>{t('settings.webhooks.colRetries')}</TableHead>
                    <TableHead>{t('settings.webhooks.colStatus')}</TableHead>
                    <TableHead className="text-right">{t('settings.webhooks.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveriesQuery.data.data.map((log) => (
                    <Fragment key={log.id}>
                      <TableRow>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatWebhookDate(log.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.event}</TableCell>
                        <TableCell>{log.statusCode ?? '—'}</TableCell>
                        <TableCell>
                          {log.duration != null ? `${log.duration} ms` : '—'}
                        </TableCell>
                        <TableCell>{log.attempt}</TableCell>
                        <TableCell>
                          <Badge
                            variant={log.status === 'SUCCESS' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {deliveryStatusLabel(log.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedLogId((cur) => (cur === log.id ? null : log.id))
                            }
                          >
                            {expandedLogId === log.id
                              ? t('settings.webhooks.hideResponse')
                              : t('settings.webhooks.showResponse')}
                          </Button>
                          {log.status === 'FAILED' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={redeliverMutation.isPending}
                              onClick={() =>
                                redeliverMutation.mutate({
                                  endpointId: deliveriesEndpointId,
                                  deliveryId: log.id,
                                })
                              }
                            >
                              <RefreshCw className="mr-1 size-3.5" />
                              {t('settings.webhooks.retry')}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                      {expandedLogId === log.id ? (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/40">
                            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                              {log.responseBody && log.responseBody.length > 0
                                ? log.responseBody
                                : t('settings.webhooks.noResponseBody')}
                            </pre>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : null}

      <CreateWebhookModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        isPending={createMutation.isPending}
        onSubmit={(input) => createMutation.mutate(input)}
      />

      <Dialog open={editingEndpoint !== null} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('settings.webhooks.editTitle')}</DialogTitle>
            <DialogDescription>{t('settings.webhooks.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wh-edit-name">{t('settings.webhooks.nameLabel')}</Label>
              <Input
                id="wh-edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-edit-url">{t('settings.webhooks.urlLabel')}</Label>
              <Input id="wh-edit-url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} />
            </div>
            {editingEndpoint ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label>{t('settings.webhooks.secretLabel')}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecret((v) => !v)}
                      disabled={!displaySecret}
                    >
                      {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={rotateSecretMutation.isPending}
                      onClick={() => rotateSecretMutation.mutate(editingEndpoint.id)}
                    >
                      {t('settings.webhooks.rotateSecret')}
                    </Button>
                  </div>
                </div>
                {displaySecret ? (
                  <Input
                    readOnly
                    type={showSecret ? 'text' : 'password'}
                    value={displaySecret}
                    className="font-mono text-xs"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('settings.webhooks.secretHiddenHint')}
                  </p>
                )}
              </div>
            ) : null}
            <div className="space-y-3">
              <Label>{t('settings.webhooks.eventsLabel')}</Label>
              {groupedEvents.map(([group, events]) => (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  <div className="grid gap-2">
                    {events.map((ev) => (
                      <label
                        key={ev.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2"
                      >
                        <Checkbox
                          checked={selectedEvents.has(ev.id)}
                          onCheckedChange={(v) => toggleEvent(ev.id, v === true)}
                        />
                        <span className="text-sm">
                          {ev.label}{' '}
                          <span className="text-muted-foreground">({ev.id})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditDialog}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                !formName.trim() ||
                !formUrl.trim() ||
                selectedEvents.size === 0 ||
                updateMutation.isPending
              }
              onClick={() => updateMutation.mutate()}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(createdSecret)} onOpenChange={() => setCreatedSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.webhooks.secretTitle')}</DialogTitle>
            <DialogDescription>{t('settings.webhooks.secretDescription')}</DialogDescription>
          </DialogHeader>
          {createdSecret ? (
            <div className="space-y-2">
              <Label>{t('settings.webhooks.secretLabel')}</Label>
              <div className="flex gap-2">
                <Input readOnly value={createdSecret.secret} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdSecret.secret);
                    toast.success(t('settings.apiKeys.copySuccess'));
                  }}
                >
                  {t('settings.apiKeys.copyButton')}
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={() => setCreatedSecret(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.webhooks.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.webhooks.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate(deleteId);
                }
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
