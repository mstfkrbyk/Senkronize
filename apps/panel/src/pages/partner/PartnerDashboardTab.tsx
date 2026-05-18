import type { ReactElement } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
import { useImpersonationStore } from '@/store/impersonation.store';
import type { PartnerStatus } from '@/types/partner';

import { usePartnerClientAccess, usePartnerDashboard } from './hooks/usePartner';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});

function formatTry(value: number): string {
  return tryFormatter.format(value);
}

const statusLabels: Record<PartnerStatus, string> = {
  PENDING: 'Beklemede',
  ACTIVE: 'Aktif',
  SUSPENDED: 'Askıda',
  TERMINATED: 'Sonlandı',
};

export function PartnerDashboardTab(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startImpersonation = useImpersonationStore((s) => s.startImpersonation);
  const accessClient = usePartnerClientAccess();
  const { data, isLoading, isError, error } = usePartnerDashboard();

  async function handleAccess(
    clientOrgId: string,
    clientName: string,
  ): Promise<void> {
    try {
      const { impersonationToken } = await accessClient.mutateAsync(clientOrgId);
      startImpersonation({ id: clientOrgId, name: clientName }, impersonationToken);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    }
  }

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
        {isError ? getApiErrorMessage(error) : 'Özet yüklenemedi.'}
      </div>
    );
  }

  const { unique, min, max } = data.commissionPctSummary;
  const commissionText =
    unique.length === 1
      ? `Müşteri abonelik ödemeleri üzerinden %${unique[0]} komisyon kazanıyorsunuz.`
      : unique.length > 1
        ? `Komisyon oranları müşteri bazında değişir (%${min} – %${max}).`
        : 'Henüz aktif komisyon oranı tanımlı müşteri yok.';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Özet</h2>
        <p className="text-sm text-muted-foreground">
          Müşteri sayıları ve komisyon durumunuz.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Müşteri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.totalClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Son 30 Gün Aktif Müşteri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.activeClients30d}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bu Ay Komisyon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatTry(data.monthlyCommission)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Komisyon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatTry(data.totalCommission)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Komisyon oranı</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{commissionText}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Müşteriler</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:px-6">
            {data.clients.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                Henüz aktif müşteri yok. Müşteri Davet sekmesinden davet gönderebilirsiniz.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organizasyon</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">Bağlantı</TableHead>
                    <TableHead className="text-right">Sipariş (30 gün)</TableHead>
                    <TableHead className="text-right">Erişim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.clients.map((row) => (
                    <TableRow key={row.clientOrgId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{statusLabels[row.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{row.connectionCount}</TableCell>
                      <TableCell className="text-right">{row.orders30d}</TableCell>
                      <TableCell className="text-right">
                        {row.canImpersonate ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={accessClient.isPending}
                            onClick={() => void handleAccess(row.clientOrgId, row.name)}
                          >
                            <LogIn className="mr-1 size-4" />
                            Erişim
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Son aktiviteler</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz kayıtlı aktivite yok.</p>
            ) : (
              <ul className="space-y-3">
                {data.recentActivities.map((a, i) => (
                  <li key={`${a.happenedAt}-${i}`} className="text-sm">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(a.happenedAt), 'd MMM yyyy HH:mm', { locale: tr })}
                      {a.detail ? ` — ${a.detail}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
