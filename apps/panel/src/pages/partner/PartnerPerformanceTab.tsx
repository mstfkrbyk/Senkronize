import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';

import { usePartnerPerformance } from './hooks/usePartner';

function formatTry(n: number): string {
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PartnerPerformanceTab(): ReactElement {
  const { data, isLoading, isError, error } = usePartnerPerformance();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
    );
  }

  if (!data) {
    return <></>;
  }

  const avgCap = Math.max(data.avgCommissionPerClientTRY * 2, 1);
  const progressPct = Math.min(
    100,
    Math.round((data.avgCommissionPerClientTRY / avgCap) * 100),
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aktif müşteri</CardDescription>
            <CardTitle className="text-3xl">{data.totalActiveClients}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bu ay yeni müşteri</CardDescription>
            <CardTitle className="text-3xl">{data.newClientsThisMonth}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ortalama müşteri başına aylık komisyon</CardDescription>
            <CardTitle className="text-2xl">₺{formatTry(data.avgCommissionPerClientTRY)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progressPct} className="h-2" />
            <p className="mt-1 text-xs text-muted-foreground">Bu ay dağılım özeti</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium">En kârlı müşteriler (bu ay)</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Müşteri</TableHead>
                <TableHead className="text-right">Komisyon (TRY)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topProfitableClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-20 text-center text-muted-foreground">
                    Henüz veri yok.
                  </TableCell>
                </TableRow>
              ) : (
                data.topProfitableClients.map((c) => (
                  <TableRow key={c.clientOrgId}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">₺{formatTry(c.commissionThisMonthTRY)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
