import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { PartnerClientBadges } from '@/components/PartnerClientBadges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { partnerStatusLabel } from '@/lib/partner-i18n-labels';

import { usePartnerDashboard } from './hooks/usePartner';
import { useEnterPartnerClient } from './useEnterPartnerClient';
import { PartnerCommissionNoteAlert } from './PartnerCommissionNoteAlert';

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});

function formatTry(value: number): string {
  return tryFormatter.format(value);
}

export function PartnerDashboardTab(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enterClient, isEnteringClient } = useEnterPartnerClient();
  const { data, isLoading, isError, error, refetch } = usePartnerDashboard();

  if (isLoading) {
    return (
      <div
        className="space-y-6"
        aria-busy="true"
        aria-label={t('partner.pages.dashboard.loadingAria')}
      >
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-28 w-full rounded-lg" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="p-4 sm:px-6">
            <TableSkeleton rows={5} cols={5} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <QueryErrorAlert
        error={error ?? new Error(t('partner.pages.dashboard.loadFailed'))}
        onRetry={
          isError
            ? () => {
                void refetch();
              }
            : undefined
        }
      />
    );
  }

  const clients = data.clients ?? [];
  const recentActivities = data.recentActivities ?? [];
  const { unique = [], min = 0, max = 0 } = data.commissionPctSummary ?? {
    unique: [],
    min: 0,
    max: 0,
  };
  const commissionText =
    unique.length === 1
      ? `Müşteri abonelik ödemeleri üzerinden %${unique[0]} komisyon kazanıyorsunuz.`
      : unique.length > 1
        ? `Komisyon oranları müşteri bazında değişir (%${min} – %${max}).`
        : 'Henüz aktif komisyon oranı tanımlı müşteri yok.';

  return (
    <div className="space-y-6">
      <PartnerCommissionNoteAlert note={data.commissionNote} />

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
            {clients.length === 0 ? (
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
                  {clients.map((row) => (
                    <TableRow
                      key={row.clientOrgId}
                      className="cursor-pointer hover:bg-muted/50"
                      tabIndex={0}
                      onClick={() => {
                        if (row.canImpersonate) {
                          void enterClient(row.clientOrgId, row.name);
                          return;
                        }
                        navigate('/partner/clients');
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') {
                          return;
                        }
                        e.preventDefault();
                        if (row.canImpersonate) {
                          void enterClient(row.clientOrgId, row.name);
                          return;
                        }
                        navigate('/partner/clients');
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <PartnerClientBadges
                          orgProducts={row.orgProducts}
                          accountingMode={row.accountingMode}
                          className="mt-1"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {partnerStatusLabel(row.status, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{row.connectionCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.orders30d}</TableCell>
                      <TableCell className="text-right">
                        {row.canImpersonate ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isEnteringClient(row.clientOrgId)}
                            onClick={(e) => {
                              e.stopPropagation();
                              void enterClient(row.clientOrgId, row.name);
                            }}
                          >
                            {isEnteringClient(row.clientOrgId) ? (
                              <Loader2
                                className="mr-1 size-4 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <LogIn className="mr-1 size-4" aria-hidden />
                            )}
                            {isEnteringClient(row.clientOrgId)
                              ? t('partner.pages.clients.enteringClient')
                              : t('partner.pages.clients.enterClient')}
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
            {recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz kayıtlı aktivite yok.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivities.map((a, i) => (
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
