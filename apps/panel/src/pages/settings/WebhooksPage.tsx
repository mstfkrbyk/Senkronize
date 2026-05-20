import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  formatWebhookDate,
  WEBHOOK_EVENTS,
  type WebhookEndpointCreated,
  type WebhookEndpointRow,
} from './webhooks.constants';

export function WebhooksPage(): ReactElement {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    () => new Set(['order.created']),
  );
  const [createdSecret, setCreatedSecret] = useState<WebhookEndpointCreated | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const endpointsQuery = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: async (): Promise<WebhookEndpointRow[]> => {
      const { data } = await api.get<WebhookEndpointRow[]>('webhooks');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (): Promise<WebhookEndpointCreated> => {
      const events = [...selectedEvents];
      const { data } = await api.post<WebhookEndpointCreated>('webhooks', {
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`webhooks/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Uç nokta silindi');
      setDeleteId(null);
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

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, (typeof WEBHOOK_EVENTS)[number][]>();
    for (const ev of WEBHOOK_EVENTS) {
      const list = groups.get(ev.group) ?? [];
      list.push(ev);
      groups.set(ev.group, list);
    }
    return [...groups.entries()];
  }, []);

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
            Sipariş, stok ve sistem olaylarını HTTPS uç noktanıza iletin. İstek gövdesi HMAC-SHA256
            ile imzalanır (<code className="text-xs">X-Senkronize-Signature</code>).
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
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
              <TableHead>Son teslimat</TableHead>
              <TableHead className="w-[160px] text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpointsQuery.data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link
                    to={`/settings/webhooks/${row.id}`}
                    className="text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                  {!row.isActive ? (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Pasif
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-[240px] truncate text-muted-foreground" title={row.url}>
                  {row.url}
                </TableCell>
                <TableCell>{row.events.length} olay</TableCell>
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
                <TableCell className="text-right space-x-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link to={`/settings/webhooks/${row.id}`}>Detay</Link>
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
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni webhook endpoint</DialogTitle>
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
