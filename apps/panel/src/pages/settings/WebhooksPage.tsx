import type { ReactElement } from 'react';
import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
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
} from './webhooks.constants';

type EndpointDialogMode = 'create' | 'edit';

export function WebhooksPage(): ReactElement {
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<EndpointDialogMode | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpointRow | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    () => new Set(['order.created']),
  );
  const [createdSecret, setCreatedSecret] = useState<WebhookEndpointCreated | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deliveriesEndpointId, setDeliveriesEndpointId] = useState<string | null>(null);
  const [deliveriesPage, setDeliveriesPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const endpointsQuery = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: async (): Promise<WebhookEndpointRow[]> => {
      const { data } = await api.get<WebhookEndpointRow[]>('webhooks');
      return data;
    },
  });

  const deliveriesQuery = useQuery({
    queryKey: ['webhook-deliveries', deliveriesEndpointId, deliveriesPage],
    enabled: Boolean(deliveriesEndpointId),
    queryFn: async (): Promise<WebhookDeliveryLogsResponse> => {
      const { data } = await api.get<WebhookDeliveryLogsResponse>(
        `webhooks/${deliveriesEndpointId}/deliveries`,
        { params: { page: deliveriesPage, limit: 50 } },
      );
      return data;
    },
  });

  const openCreateDialog = (): void => {
    setDialogMode('create');
    setEditingEndpoint(null);
    setFormName('');
    setFormUrl('');
    setSelectedEvents(new Set(['order.created']));
    setShowSecret(false);
    setRotatedSecret(null);
  };

  const openEditDialog = (row: WebhookEndpointRow): void => {
    setDialogMode('edit');
    setEditingEndpoint(row);
    setFormName(row.name);
    setFormUrl(row.url);
    setSelectedEvents(new Set(row.events));
    setShowSecret(false);
    setRotatedSecret(null);
  };

  const closeDialog = (): void => {
    setDialogMode(null);
    setEditingEndpoint(null);
  };

  const createMutation = useMutation({
    mutationFn: async (): Promise<WebhookEndpointCreated> => {
      const events = [...selectedEvents];
      const { data } = await api.post<WebhookEndpointCreated>('webhooks', {
        name: formName.trim(),
        url: formUrl.trim(),
        events,
      });
      return data;
    },
    onSuccess: (data) => {
      setCreatedSecret(data);
      closeDialog();
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook uç noktası oluşturuldu');
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
      closeDialog();
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Endpoint güncellendi');
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
      toast.success('Uç nokta silindi');
      setDeleteId(null);
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
          ? `Test başarılı (HTTP ${delivery.statusCode ?? '—'}, ${delivery.duration ?? '—'} ms)`
          : `Test başarısız (HTTP ${delivery.statusCode ?? '—'})`,
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
      toast.success('Secret yenilendi');
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
      toast.success('Teslimat yeniden kuyruğa alındı');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }): Promise<void> => {
      await api.patch(`webhooks/${id}`, { isActive });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
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

  const canSubmitForm = useMemo(() => {
    return formName.trim().length > 0 && formUrl.trim().length > 0 && selectedEvents.size > 0;
  }, [formName, formUrl, selectedEvents]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, (typeof WEBHOOK_EVENTS)[number][]>();
    for (const ev of WEBHOOK_EVENTS) {
      const list = groups.get(ev.group) ?? [];
      list.push(ev);
      groups.set(ev.group, list);
    }
    return [...groups.entries()];
  }, []);

  const deliveriesEndpoint = endpointsQuery.data?.find((r) => r.id === deliveriesEndpointId);
  const deliveriesTotalPages = deliveriesQuery.data
    ? Math.max(1, Math.ceil(deliveriesQuery.data.total / deliveriesQuery.data.limit))
    : 1;

  const displaySecret = rotatedSecret ?? createdSecret?.secret ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/settings?tab=webhooks" className="hover:underline">
              Ayarlar
            </Link>
            {' / '}
            <span className="text-foreground">Webhook&apos;lar</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Giden webhook&apos;lar</h1>
          <p className="text-sm text-muted-foreground">
            Sipariş, stok ve sistem olaylarını HTTPS uç noktanıza iletin. İmza:{' '}
            <code className="text-xs">X-Senkronize-Signature-256: sha256=…</code>
          </p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          Yeni endpoint
        </Button>
      </div>

      {endpointsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : endpointsQuery.isError ? (
        <p className="text-sm text-destructive">Liste yüklenemedi.</p>
      ) : !endpointsQuery.data?.length ? (
        <p className="text-sm text-muted-foreground">Henüz webhook uç noktası yok.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>İsim</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Olaylar</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Son teslimat</TableHead>
              <TableHead className="w-[280px] text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpointsQuery.data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground" title={row.url}>
                  {row.url}
                </TableCell>
                <TableCell>{row.events.length} olay</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.status === 'DISABLED' || !row.isActive
                        ? 'destructive'
                        : 'default'
                    }
                    className="text-xs"
                  >
                    {endpointStatusLabel(row.status, row.isActive)}
                  </Badge>
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
                    <span className="text-sm text-muted-foreground">Henüz yok</span>
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
                        setDeliveriesPage(1);
                        setExpandedLogId(null);
                      }}
                    >
                      Loglar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testMutation.isPending}
                      onClick={() => testMutation.mutate(row.id)}
                    >
                      Test
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(row)}
                    >
                      Düzenle
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteId(row.id)}
                    >
                      Sil
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {deliveriesEndpointId && deliveriesEndpoint ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Teslimat geçmişi</h2>
              <p className="text-sm text-muted-foreground">{deliveriesEndpoint.name}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeliveriesEndpointId(null)}
            >
              Kapat
            </Button>
          </div>
          {deliveriesQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : deliveriesQuery.isError ? (
            <p className="text-sm text-destructive">Loglar yüklenemedi.</p>
          ) : !deliveriesQuery.data?.data.length ? (
            <p className="text-sm text-muted-foreground">Henüz teslimat kaydı yok.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Olay</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Gecikme</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
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
                            onClick={() =>
                              setExpandedLogId((cur) => (cur === log.id ? null : log.id))
                            }
                          >
                            {expandedLogId === log.id ? 'Gizle' : 'Yanıt'}
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
                              Yeniden gönder
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
              {deliveriesTotalPages > 1 ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deliveriesPage <= 1}
                    onClick={() => setDeliveriesPage((p) => Math.max(1, p - 1))}
                  >
                    Önceki
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Sayfa {deliveriesPage} / {deliveriesTotalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deliveriesPage >= deliveriesTotalPages}
                    onClick={() => setDeliveriesPage((p) => p + 1)}
                  >
                    Sonraki
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit' ? 'Endpoint düzenle' : 'Yeni webhook endpoint'}
            </DialogTitle>
            <DialogDescription>
              HTTPS URL ve dinlemek istediğiniz olayları seçin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wh-name">İsim</Label>
              <Input
                id="wh-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Örn. ERP entegrasyonu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">URL</Label>
              <Input
                id="wh-url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            {dialogMode === 'edit' && editingEndpoint ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label>Secret (HMAC)</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecret((v) => !v)}
                      disabled={!displaySecret}
                    >
                      {showSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={rotateSecretMutation.isPending}
                      onClick={() => rotateSecretMutation.mutate(editingEndpoint.id)}
                    >
                      Yenile
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
                    Secret yalnızca oluşturma veya yenileme sonrası gösterilir.
                  </p>
                )}
                <div className="flex items-center justify-between pt-2">
                  <Label htmlFor="wh-active">Aktif</Label>
                  <Switch
                    id="wh-active"
                    checked={editingEndpoint.isActive && editingEndpoint.status === 'ACTIVE'}
                    disabled={toggleActiveMutation.isPending}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({
                        id: editingEndpoint.id,
                        isActive: checked,
                      })
                    }
                  />
                </div>
              </div>
            ) : null}
            <div className="space-y-3">
              <Label>Olaylar</Label>
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
            <Button type="button" variant="outline" onClick={closeDialog}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={
                !canSubmitForm ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              onClick={() => {
                if (dialogMode === 'create') {
                  createMutation.mutate();
                } else {
                  updateMutation.mutate();
                }
              }}
            >
              {dialogMode === 'edit' ? 'Kaydet' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(createdSecret)} onOpenChange={() => setCreatedSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook secret</DialogTitle>
            <DialogDescription>
              Bu değeri yalnızca bir kez gösteriyoruz. İmza doğrulaması için güvenli bir yerde saklayın.
            </DialogDescription>
          </DialogHeader>
          {createdSecret ? (
            <div className="space-y-2">
              <Label>Secret</Label>
              <div className="flex gap-2">
                <Input readOnly value={createdSecret.secret} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdSecret.secret);
                    toast.success('Kopyalandı');
                  }}
                >
                  Kopyala
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={() => setCreatedSecret(null)}>
              Tamam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uç noktayı sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Teslimat geçmişi de silinir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate(deleteId);
                }
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
