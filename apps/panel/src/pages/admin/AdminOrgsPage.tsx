import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminOrgListResponse } from '@/types/admin';

const PLAN_LABEL: Record<string, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

const SUB_LABEL: Record<string, string> = {
  TRIAL: 'Deneme',
  ACTIVE: 'Aktif',
  PAUSED: 'Duraklatıldı',
  CANCELLED: 'İptal',
  EXPIRED: 'Süresi doldu',
};

const PAGE_SIZE = 20;

export function AdminOrgsPage(): ReactElement {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'organizations', page, search],
    queryFn: async (): Promise<AdminOrgListResponse> => {
      const { data: res } = await api.get<AdminOrgListResponse>(
        '/admin/organizations',
        { params: { page, limit: PAGE_SIZE, search: search || undefined } },
      );
      return res;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (payload: { id: string; suspended: boolean }) => {
      await api.patch(`/admin/organizations/${payload.id}/status`, {
        suspended: payload.suspended,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success('Organizasyon durumu güncellendi.');
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const total = data?.total ?? 0;
  const limit = data?.limit ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Organizasyonlar</h2>
          <p className="text-sm text-muted-foreground">
            Tüm kiracıları arayın, durumlarını ve paketlerini görüntüleyin.
          </p>
        </div>
        <form
          className="flex w-full max-w-md gap-2 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchDraft.trim());
          }}
        >
          <Input
            placeholder="Organizasyon adı ara…"
            value={searchDraft}
            onChange={(e) => {
              setSearchDraft(e.target.value);
            }}
          />
          <Button type="submit">Ara</Button>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(error)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void refetch();
            }}
          >
            Tekrar dene
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && data ? (
        <>
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizasyon</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Kullanıcı</TableHead>
                  <TableHead className="text-right">Bağlantı</TableHead>
                  <TableHead>Kayıt</TableHead>
                  <TableHead className="w-[1%]">Aksiyon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Kayıt bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.orgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        {org.subscription
                          ? PLAN_LABEL[org.subscription.plan] ?? org.subscription.plan
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {org.suspended ? (
                            <Badge variant="destructive">Askıda</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                              Aktif
                            </Badge>
                          )}
                          {org.subscription ? (
                            <Badge variant="outline">
                              {SUB_LABEL[org.subscription.status] ??
                                org.subscription.status}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {org._count.users}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {org._count.marketplaceConnections}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(new Date(org.createdAt), 'd MMM yyyy', { locale: tr })}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant={org.suspended ? 'outline' : 'destructive'}
                          size="sm"
                          disabled={toggleMutation.isPending}
                          onClick={() => {
                            toggleMutation.mutate({
                              id: org.id,
                              suspended: !org.suspended,
                            });
                          }}
                        >
                          {org.suspended ? 'Askıyı kaldır' : 'Hesabı geçersiz kıl'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Toplam {total.toLocaleString('tr-TR')} organizasyon — Sayfa {page} /{' '}
              {totalPages}
            </p>
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
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                }}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
