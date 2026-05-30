import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarClock, Info, Loader2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { ScheduledCustomReportItem } from '@/types/custom-report';
import type { ReportScheduleItem, UnifiedReportSchedule } from '@/types/report';

import {
  mapCustomSchedules,
  mapStandardSchedules,
  useToggleReportSchedule,
} from './hooks/useReportScheduleMutations';
import { useReportSchedules } from './hooks/useReportSchedules';
import { ReportScheduleModal } from './ReportScheduleModal';
import {
  isIntegrationScheduleReportType,
  resolveReportsProductAccess,
  resolveScheduleReportPresentation,
  resolveScheduleTabVisible,
} from './reports-tabs.config';

const TYPE_LABELS: Record<UnifiedReportSchedule['reportType'], string> = {
  SALES: 'Satış',
  VAT: 'KDV',
  PROFIT: 'Kâr-Zarar',
  CUSTOM: 'Özel',
};

const FREQ_LABELS: Record<UnifiedReportSchedule['frequency'], string> = {
  DAILY: 'Günlük',
  WEEKLY: 'Haftalık',
  MONTHLY: 'Aylık',
};

function useScheduledCustomReports(enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'scheduled'],
    queryFn: async (): Promise<ScheduledCustomReportItem[]> => {
      const { data } = await api.get<ScheduledCustomReportItem[]>('/reports/scheduled');
      return data;
    },
    enabled,
  });
}

function filterIntegrationScheduleItems(
  items: UnifiedReportSchedule[],
): UnifiedReportSchedule[] {
  return items.filter((item) => isIntegrationScheduleReportType(item.reportType));
}

export function ReportSchedulePage(): ReactElement | null {
  const { t } = useTranslation();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const productAccess = useMemo(
    () => resolveReportsProductAccess(orgProducts),
    [orgProducts],
  );
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();
  const schedulePresentation = useMemo(
    () => resolveScheduleReportPresentation(productAccess, accountingMode),
    [productAccess, accountingMode],
  );
  const showFullSchedule = schedulePresentation === 'full';
  const scheduleTabVisible = resolveScheduleTabVisible(productAccess);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const schedulesQuery = useReportSchedules({
    enabled: showFullSchedule && scheduleTabVisible,
  });
  const customQuery = useScheduledCustomReports(showFullSchedule && scheduleTabVisible);
  const toggleMutation = useToggleReportSchedule();

  const items = useMemo((): UnifiedReportSchedule[] => {
    const standard = mapStandardSchedules((schedulesQuery.data ?? []) as ReportScheduleItem[]);
    const custom = mapCustomSchedules(customQuery.data ?? []);
    return filterIntegrationScheduleItems(
      [...standard, ...custom].sort((a, b) => {
        const aTime = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
        const bTime = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0;
        return bTime - aTime;
      }),
    );
  }, [schedulesQuery.data, customQuery.data]);

  const isLoading =
    showFullSchedule &&
    scheduleTabVisible &&
    (schedulesQuery.isLoading || customQuery.isLoading);

  if (accountingModeLoading && productAccess.hasAccounting) {
    return (
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    );
  }

  if (!scheduleTabVisible) {
    return null;
  }

  if (!showFullSchedule) {
    return (
      <div id="report-schedule" className="space-y-6">
        <Alert className="border-sky-200 bg-sky-50/80 text-sky-950">
          <Info className="h-4 w-4 text-sky-600" aria-hidden />
          <AlertTitle className="text-sky-950">
            {t('reports.schedule.externalErpTitle')}
          </AlertTitle>
          <AlertDescription className="text-sky-900/90">
            <p>{t('reports.schedule.externalErpDescription')}</p>
            <p className="mt-3 flex flex-wrap gap-3">
              <Link
                to="/reports?tab=erp-transfer"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('reports.schedule.openErpTransfer')}
              </Link>
              <Link
                to="/connections?tab=erp"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('reports.schedule.openConnections')}
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div id="report-schedule" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t('reports.schedule.subtitle')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni zamanlama
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            Zamanlanmış raporlar
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Henüz zamanlanmış rapor yok. Yeni zamanlama oluşturun.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rapor tipi</TableHead>
                  <TableHead>Sıklık</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Son gönderim</TableHead>
                  <TableHead>Alıcılar</TableHead>
                  <TableHead className="text-right">Aktif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.source}-${item.id}`}>
                    <TableCell>
                      <div className="font-medium">
                        {item.name ?? TYPE_LABELS[item.reportType]}
                      </div>
                      {!item.isActive ? (
                        <Badge variant="secondary" className="mt-1">
                          Duraklatıldı
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{FREQ_LABELS[item.frequency]}</TableCell>
                    <TableCell>{item.format}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {item.lastRunAt
                        ? format(new Date(item.lastRunAt), 'dd MMM yyyy HH:mm', { locale: tr })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {item.emails.length > 0
                          ? item.emails.join(', ')
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {toggleMutation.isPending &&
                      toggleMutation.variables?.item.id === item.id ? (
                        <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                      ) : (
                        <Switch
                          checked={item.isActive}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ item, active: checked })
                          }
                          aria-label={`${TYPE_LABELS[item.reportType]} zamanlamasını ${
                            item.isActive ? 'kapat' : 'aç'
                          }`}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReportScheduleModal open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </div>
  );
}
