import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  ShoppingBag,
  Tag,
  User,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { platformLabel } from '@/pages/campaigns/campaign-labels';
import {
  formatCustomerDate,
  formatTryAmount,
  SEGMENT_BADGE_CLASS,
  SEGMENT_LABELS,
} from '@/lib/customer-segments';
import { api, getApiErrorMessage } from '@/lib/api';
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
import type { CustomerDetailDto } from '@/types/customer';
import type { OrderStatus } from '@/types/order';

export function CustomerDetailPage(): ReactElement {
  const { t } = useTranslation();
  const { id: customerId } = useParams<{ id: string }>();
  const id = customerId ?? '';
  const queryClient = useQueryClient();
  const [newTag, setNewTag] = useState('');
  const [noteText, setNoteText] = useState('');

  const detailQuery = useQuery({
    queryKey: ['customer', id],
    enabled: id.length > 0,
    queryFn: async (): Promise<CustomerDetailDto> => {
      const { data } = await api.get<{ data: CustomerDetailDto }>(
        `/customers/${id}`,
      );
      return data.data;
    },
  });

  usePageTitle(detailQuery.data?.name ?? 'Müşteri');

  const tagMutation = useMutation({
    mutationFn: async (payload: {
      action: 'add' | 'remove';
      tag: string;
    }): Promise<void> => {
      await api.patch(`/customers/${id}/tags`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customer', id] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const noteMutation = useMutation({
    mutationFn: async (note: string): Promise<void> => {
      await api.post(`/customers/${id}/notes`, { note });
    },
    onSuccess: async () => {
      toast.success('Not eklendi.');
      setNoteText('');
      await queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  if (!id) {
    return (
      <div className="p-6">
        <EmptyState
          icon={User}
          title="Geçersiz bağlantı"
          description="Müşteri seçilemedi."
        />
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

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="p-6">
        <EmptyState
          icon={User}
          title="Müşteri bulunamadı"
          description={getApiErrorMessage(detailQuery.error)}
        />
      </div>
    );
  }

  const customer = detailQuery.data;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/customers">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <div className="mt-1 flex flex-wrap gap-1">
            {customer.segments.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className={SEGMENT_BADGE_CLASS[s]}
              >
                {SEGMENT_LABELS[s]}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam sipariş
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{customer.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam harcama
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatTryAmount(customer.totalSpent)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ortalama sepet (AOV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatTryAmount(customer.averageOrderValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Son sipariş
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCustomerDate(customer.lastOrderAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">İletişim bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">E-posta</p>
              <p>{customer.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Telefon</p>
              <p>{customer.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Şehir</p>
              <p>{customer.city ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pazaryeri</p>
              <p>{customer.platform ? platformLabel(customer.platform) : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">İlk sipariş</p>
              <p>{formatCustomerDate(customer.firstOrderAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="size-4" />
              Etiketler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {customer.tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz etiket yok.</p>
              ) : (
                customer.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      aria-label={`${tag} etiketini kaldır`}
                      onClick={() =>
                        tagMutation.mutate({ action: 'remove', tag })
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Yeni etiket…"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    tagMutation.mutate({ action: 'add', tag: newTag.trim() });
                    setNewTag('');
                  }
                }}
              />
              <Button
                disabled={!newTag.trim() || tagMutation.isPending}
                onClick={() => {
                  tagMutation.mutate({ action: 'add', tag: newTag.trim() });
                  setNewTag('');
                }}
              >
                Ekle
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notlar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {customer.notes ? (
            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
              {customer.notes}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz not eklenmemiş.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="customer-note">Yeni not</Label>
            <Textarea
              id="customer-note"
              placeholder="Müşteri hakkında not ekleyin…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
            />
            <Button
              disabled={!noteText.trim() || noteMutation.isPending}
              onClick={() => noteMutation.mutate(noteText.trim())}
            >
              Not ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="size-4" />
            Sipariş geçmişi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customer.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bu müşteriye ait sipariş bulunamadı.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sipariş no</TableHead>
                  <TableHead>Pazaryeri</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">
                      {o.platformOrderId}
                    </TableCell>
                    <TableCell>{platformLabel(o.platform)}</TableCell>
                    <TableCell>
                      {t(
                        ORDER_STATUS_I18N_KEY[o.status as OrderStatus] ??
                          'orders.statusUnknown',
                      )}
                    </TableCell>
                    <TableCell>{formatCustomerDate(o.platformCreatedAt)}</TableCell>
                    <TableCell className="text-right">
                      {formatTryAmount(o.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
