import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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

import { useCommissionSummary } from './hooks/usePartner';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});

function formatTry(value: number): string {
  return tryFormatter.format(value);
}

function formatAmountString(value: string): string {
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

export function CommissionTab(): ReactElement {
  const { data, isLoading, isError, error } = useCommissionSummary();

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
        {isError ? getApiErrorMessage(error) : 'Komisyon verisi yüklenemedi.'}
      </div>
    );
  }

  const ledger = data.ledger ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Komisyon</h2>
        <p className="text-sm text-muted-foreground">Kazanç özeti ve hareketler.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Kazanılan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatTry(data.totalEarned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bekleyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatTry(data.pendingAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ödenen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatTry(data.settledAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktif Müşteri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.activeClients}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hareketler</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          {ledger.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Henüz komisyon kaydı yok.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tür</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.type}</TableCell>
                    <TableCell className="font-medium">
                      {formatAmountString(row.amount)}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {row.description ?? '—'}
                    </TableCell>
                    <TableCell>{ledgerStatusBadge(row.status)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {format(new Date(row.createdAt), 'd MMM yyyy HH:mm', { locale: tr })}
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
