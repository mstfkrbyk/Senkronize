import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2, LogIn, TrendingUp, Users } from 'lucide-react';
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

import {
  useCommissionReport,
  usePartnerClientAccess,
  usePartnerDashboard,
  usePartnerPerformance,
} from './hooks/usePartner';
import { formatTry, PARTNER_STATUS_LABELS } from './partner-utils';

export function PartnerDashboardPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, isLoading, isError, error } = usePartnerDashboard();
  const performance = usePartnerPerformance();
  const report = useCommissionReport(year, month);
  const accessClient = usePartnerClientAccess();
  const startImpersonation = useImpersonationStore((s) => s.startImpersonation);

  const chartData = useMemo(() => {
    return (report.data?.trendLast6Months ?? []).map((m) => ({
      name: m.label,
      tutar: m.total,
    }));
  }, [report.data?.trendLast6Months]);

  const topActive = useMemo(() => {
    if (!data?.clients.length) {
      return null;
    }
    return [...data.clients].sort((a, b) => b.orders30d - a.orders30d)[0];
  }, [data?.clients]);

  const topCommission = useMemo(() => {
    const rows = performance.data?.topProfitableClients ?? [];
    return rows[0] ?? null;
  }, [performance.data?.topProfitableClients]);

  const recentClients = useMemo(() => {
    return (data?.clients ?? []).slice(0, 5);
  }, [data?.clients]);

  async function handleAccess(clientOrgId: string, clientName: string): Promise<void> {
    try {
      const { impersonationToken } = await accessClient.mutateAsync(clientOrgId);
      startImpersonation({ id: clientOrgId, name: clientName }, impersonationToken);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    }
  }

  if (isLoading || report.isLoading) {
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
      ? `Varsayılan komisyon oranı: %${unique[0]} (admin tarafından belirlenir).`
      : unique.length > 1
        ? `Komisyon oranları müşteri bazında %${min} – %${max} aralığında.`
        : 'Henüz aktif komisyon oranı tanımlı müşteri yok.';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam müşteri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.totalClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktif müşteri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.activeClients30d}</p>
            <p className="text-xs text-muted-foreground">Son 30 günde siparişi olan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bu ay komisyon geliri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatTry(data.monthlyCommission)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam kazanç
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatTry(data.totalCommission)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Komisyon gelir trendi (son 6 ay)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz trend verisi yok.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [
                      typeof value === 'number' ? formatTry(value) : String(value ?? ''),
                      'Komisyon',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="tutar"
                    stroke="#38bdf8"
                    fill="#38bdf8"
                    fillOpacity={0.2}
                    name="Komisyon"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-sky-500" aria-hidden />
              Performans özeti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">En aktif müşteri</p>
              <p className="font-medium">
                {topActive
                  ? `${topActive.name} (${topActive.orders30d} sipariş / 30 gün)`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">En yüksek komisyon getiren müşteri</p>
              <p className="font-medium">
                {topCommission
                  ? `${topCommission.name} (${formatTry(topCommission.commissionThisMonthTRY)})`
                  : '—'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{commissionText}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-sky-500" aria-hidden />
              Son aktiviteler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz kayıtlı aktivite yok.</p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
                {data.recentActivities.slice(0, 5).map((a, i) => (
                  <li key={`${a.happenedAt}-${i}`}>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son müşteriler</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          {recentClients.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Henüz müşteri yok.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Sipariş (30 gün)</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentClients.map((row) => (
                  <TableRow key={row.clientOrgId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {PARTNER_STATUS_LABELS[row.status as PartnerStatus]}
                      </Badge>
                    </TableCell>
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
                          Müşteri paneline gir
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
    </div>
  );
}
