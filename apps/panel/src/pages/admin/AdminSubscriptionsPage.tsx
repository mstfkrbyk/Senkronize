import type { ReactElement } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { AdminSubscriptionRow, SubStatus } from '@/types/admin';

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

const STATUS_OPTIONS: { value: SubStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tümü' },
  { value: 'TRIAL', label: 'Deneme' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'PAUSED', label: 'Duraklatıldı' },
  { value: 'CANCELLED', label: 'İptal' },
  { value: 'EXPIRED', label: 'Süresi doldu' },
];

export function AdminSubscriptionsPage(): ReactElement {
  const [status, setStatus] = useState<SubStatus | 'ALL'>('ALL');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'subscriptions', status],
    queryFn: async (): Promise<AdminSubscriptionRow[]> => {
      const { data: res } = await api.get<AdminSubscriptionRow[]>(
        '/admin/subscriptions',
        {
          params:
            status === 'ALL'
              ? undefined
              : {
                  status,
                },
        },
      );
      return res;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Abonelikler</h2>
          <p className="text-sm text-muted-foreground">
            Platform genelinde abonelik durumları.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Durum</span>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as SubStatus | 'ALL');
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizasyon</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Dönem başı</TableHead>
                <TableHead>Dönem sonu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Kayıt bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.organization.name}</div>
                      {row.organization.suspended ? (
                        <Badge variant="destructive" className="mt-1">
                          Org askıda
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {PLAN_LABEL[row.plan] ?? row.plan}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SUB_LABEL[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(row.currentPeriodStart), 'd MMM yyyy', {
                        locale: tr,
                      })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(row.currentPeriodEnd), 'd MMM yyyy', {
                        locale: tr,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
