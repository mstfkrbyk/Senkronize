import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Download, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import type { CommissionEntry } from '@/types/partner';

import { usePartnerCommissions } from './hooks/usePartner';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});

function formatTryAmount(value: string): string {
  const n = Number(value);
  if (Number.isFinite(n)) {
    return tryFormatter.format(n);
  }
  return `${value} TL`;
}

function ledgerStatusBadge(status: string): ReactElement {
  const upper = status.toUpperCase();
  if (upper === 'PENDING') {
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Beklemede</Badge>;
  }
  if (upper === 'SETTLED') {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Ödendi</Badge>;
  }
  if (upper === 'CANCELLED') {
    return <Badge variant="secondary">İptal</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

const commissionTypeTr: Record<string, string> = {
  SUBSCRIPTION_FEE: 'Abonelik',
  SERVICE_FEE: 'Hizmet',
  BONUS: 'Prim',
  DEDUCTION: 'Kesinti',
};

function typeLabel(type: string): string {
  return commissionTypeTr[type] ?? type;
}

function toCsv(rows: CommissionEntry[]): string {
  const header = ['Tarih', 'Müşteri', 'Miktar (TRY)', 'Tür', 'Durum', 'Açıklama'];
  const lines = rows.map((row) => {
    const date = format(new Date(row.createdAt), 'yyyy-MM-dd HH:mm', { locale: tr });
    const client = row.clientOrg?.name ?? '—';
    const amount = row.amount;
    const type = typeLabel(row.type);
    const status = row.status;
    const desc = (row.description ?? '').replaceAll('"', '""');
    return `"${date}","${client}","${amount}","${type}","${status}","${desc}"`;
  });
  return [header.join(','), ...lines].join('\n');
}

export function PartnerCommissionHistoryTab(): ReactElement {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data, isLoading, isError, error } = usePartnerCommissions(page, limit);

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const monthLabel = useMemo(() => {
    return format(new Date(), 'MMMM yyyy', { locale: tr });
  }, []);

  const exportCsv = useCallback(() => {
    if (items.length === 0) {
      return;
    }
    const csv = '\uFEFF' + toCsv(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `komisyon-gecmisi-sayfa-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items, page]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {isError ? getApiErrorMessage(error) : 'Komisyon listesi yüklenemedi.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Komisyon geçmişi</h2>
        <p className="text-sm text-muted-foreground">Sayfalı hareketler ve aylık özet.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Card className="flex-1 border-sky-200 bg-sky-50/50 dark:bg-sky-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bu ay toplam ({monthLabel})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {tryFormatter.format(data.currentMonthTotal)}
            </p>
          </CardContent>
        </Card>
        <Button
          type="button"
          variant="outline"
          disabled={items.length === 0}
          onClick={exportCsv}
        >
          <Download className="mr-2 size-4" />
          CSV indir (bu sayfa)
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 sm:px-6">
          {items.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Henüz komisyon kaydı yok.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Miktar</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(row.createdAt), 'd MMM yyyy HH:mm', { locale: tr })}
                    </TableCell>
                    <TableCell>{row.clientOrg?.name ?? '—'}</TableCell>
                    <TableCell className="font-medium">{formatTryAmount(row.amount)}</TableCell>
                    <TableCell>{typeLabel(row.type)}</TableCell>
                    <TableCell>{ledgerStatusBadge(row.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.total > limit ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Toplam {data.total} kayıt — sayfa {data.page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Önceki
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sonraki
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
