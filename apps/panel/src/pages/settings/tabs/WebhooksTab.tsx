import type { ReactElement } from 'react';
import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const WEBHOOK_EVENTS = [
  { id: 'order.created', label: 'Sipariş oluşturuldu' },
  { id: 'order.status_changed', label: 'Sipariş durumu değişti' },
  { id: 'stock.updated', label: 'Stok güncellendi' },
  { id: 'product.updated', label: 'Ürün güncellendi' },
] as const;

interface WebhookEndpointRow {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  retryCount: number;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
}

interface WebhookEndpointCreated extends WebhookEndpointRow {
  secret: string;
}

interface WebhookDeliveryRow {
  id: string;
  endpointId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  responseBody: string | null;
  duration: number | null;
  attempt: number;
  status: string;
  createdAt: string;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return '—';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'Başarılı';
    case 'FAILED':
      return 'Başarısız';
    case 'PENDING':
      return 'Bekliyor';
    case 'RETRYING':
      return 'Yeniden deneniyor';
    default:
      return status;
  }
}

export function WebhooksTab(): ReactElement {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    () => new Set(['order.created']),
  );
  const [createdSecret, setCreatedSecret] = useState<WebhookEndpointCreated | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const endpointsQuery = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: async (): Promise<WebhookEndpointRow[]> => {
      const { data } = await api.get<WebhookEndpointRow[]>('webhooks/endpoints');
      return data;
    },
  });

  const deliveriesQuery = useQuery({
    queryKey: ['webhook-deliveries', expandedId],
    enabled: Boolean(expandedId),
    queryFn: async (): Promise<WebhookDeliveryRow[]> => {
      const { data } = await api.get<WebhookDeliveryRow[]>(
        `webhooks/endpoints/${expandedId}/deliveries`,
      );
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (): Promise<WebhookEndpointCreated> => {
      const events = [...selectedEvents];
      const { data } = await api.post<WebhookEndpointCreated>('webhooks/endpoints', {
        name: newName.trim(),
        url: newUrl.trim(),
        events,
      });
      return data;
    },
    onSuccess: (data) => {
      setCreatedSecret(data);
      setNewName('');
      setNewUrl('');
      setSelectedEvents(new Set(['order.created']));
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook uç noktası oluşturuldu');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: WebhookEndpointRow): Promise<void> => {
      await api.patch(`webhooks/endpoints/${row.id}`, { isActive: !row.isActive });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`webhooks/endpoints/${id}`);
    },
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Uç nokta silindi');
      setDeleteId(null);
      setExpandedId((cur) => (cur === id ? null : cur));
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string): Promise<WebhookDeliveryRow> => {
      const { data } = await api.post<WebhookDeliveryRow>(`webhooks/endpoints/${id}/test`);
      return data;
    },
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', delivery.endpointId] });
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

  const canSubmitCreate = useMemo(() => {
    return newName.trim().length > 0 && newUrl.trim().length > 0 && selectedEvents.size > 0;
  }, [newName, newUrl, selectedEvents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Giden webhook&apos;lar</h2>
          <p className="text-sm text-muted-foreground">
            Sipariş, stok ve ürün olaylarını kendi HTTPS uç noktanıza iletin. İstek gövdesi HMAC-SHA256
            ile imzalanır (<code className="text-xs">X-Senkronize-Signature</code>).
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Yeni uç nokta
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
              <TableHead className="w-[100px]">Aktif</TableHead>
              <TableHead className="w-[220px] text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpointsQuery.data.map((row) => (
              <Fragment key={row.id}>
                <TableRow>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground" title={row.url}>
                    {row.url}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.events.map((e) => (
                        <Badge key={e} variant="secondary" className="text-xs">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.isActive}
                      disabled={toggleMutation.isPending}
                      onCheckedChange={() => toggleMutation.mutate(row)}
                      aria-label="Aktif"
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testMutation.isPending}
                      onClick={() => testMutation.mutate(row.id)}
                    >
                      Test et
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId((id) => (id === row.id ? null : row.id))}
                    >
                      {expandedId === row.id ? 'Geçmişi gizle' : 'Teslimatlar'}
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
                  </TableCell>
                </TableRow>
                {expandedId === row.id ? (
                  <TableRow>
                    <TableCell colSpan={5} className="bg-muted/40">
                      <WebhookDeliveriesPanel
                        loading={deliveriesQuery.isFetching}
                        error={deliveriesQuery.isError}
                        rows={deliveriesQuery.data ?? []}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni webhook uç noktası</DialogTitle>
            <DialogDescription>
              HTTPS URL ve dinlemek istediğiniz olayları seçin. Secret otomatik üretilir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wh-name">İsim</Label>
              <Input
                id="wh-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Örn. ERP entegrasyonu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">URL</Label>
              <Input
                id="wh-url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Olaylar</Label>
              <div className="grid gap-2">
                {WEBHOOK_EVENTS.map((ev) => (
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={!canSubmitCreate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Oluştur
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

interface DeliveriesPanelProps {
  loading: boolean;
  error: boolean;
  rows: WebhookDeliveryRow[];
}

function WebhookDeliveriesPanel({
  loading,
  error,
  rows,
}: DeliveriesPanelProps): ReactElement {
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (error) {
    return <p className="text-sm text-destructive">Teslimatlar yüklenemedi.</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz teslimat kaydı yok.</p>;
  }

  return (
    <div className="space-y-2 py-2">
      <p className="text-sm font-medium">Teslimat geçmişi</p>
      {rows.map((d) => {
        const open = openId === d.id;
        return (
          <Card key={d.id} className="border-dashed">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => setOpenId(open ? null : d.id)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium">
                  {formatDate(d.createdAt)} — {d.event}{' '}
                  <Badge variant={d.status === 'SUCCESS' ? 'default' : 'destructive'}>
                    {statusLabel(d.status)}
                  </Badge>
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  HTTP {d.statusCode ?? '—'} · {d.duration ?? '—'} ms · deneme {d.attempt}
                </span>
              </div>
            </CardHeader>
            {open ? (
              <CardContent className="border-t pt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Yanıt önizleme</p>
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {d.responseBody && d.responseBody.length > 0
                    ? d.responseBody
                    : '(Gövde yok)'}
                </pre>
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
