import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import type { PriceHistoryEntry } from '@/types/pricing';

interface Props {
  query: {
    data: { items: PriceHistoryEntry[]; total: number } | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
}

function formatTry(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) {
    return value;
  }
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);
}

function pctChange(oldPrice: string, newPrice: string): number {
  const o = Number(oldPrice);
  const n = Number(newPrice);
  if (Number.isNaN(o) || o === 0 || Number.isNaN(n)) {
    return 0;
  }
  return ((n - o) / o) * 100;
}

export function PriceHistoryTable({ query }: Props): ReactElement {
  const { data, isLoading, isError, error } = query;

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barkod</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Eski fiyat</TableHead>
              <TableHead>Yeni fiyat</TableHead>
              <TableHead>Değişim</TableHead>
              <TableHead>Neden</TableHead>
              <TableHead>Tarih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {getApiErrorMessage(error)}
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Henüz fiyat geçmişi kaydı yok.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Barkod</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Eski fiyat</TableHead>
            <TableHead>Yeni fiyat</TableHead>
            <TableHead>Değişim %</TableHead>
            <TableHead>Neden</TableHead>
            <TableHead>Tarih</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.slice(0, 20).map((row) => {
            const delta = pctChange(row.oldPrice, row.newPrice);
            const down = delta < 0;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
                <TableCell>{row.platform}</TableCell>
                <TableCell>{formatTry(row.oldPrice)}</TableCell>
                <TableCell>{formatTry(row.newPrice)}</TableCell>
                <TableCell
                  className={
                    down
                      ? 'font-medium text-green-600'
                      : delta > 0
                        ? 'font-medium text-red-600'
                        : 'text-muted-foreground'
                  }
                >
                  {delta === 0 ? '—' : `%${delta.toFixed(1)}`}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {row.reason ?? '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {format(new Date(row.appliedAt), 'd MMM yyyy HH:mm', { locale: tr })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
