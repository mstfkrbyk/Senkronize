import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';

import { CustomReportsTab } from './CustomReportsTab';
import { PlatformAnalyticsTab } from './PlatformAnalyticsTab';
import { ProfitLossTab } from './ProfitLossTab';
import { SalesReportTab } from './SalesReportTab';
import { ScheduledReportsTab } from './ScheduledReportsTab';
import { TaxReportTab } from './TaxReportTab';

export function ReportsPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('nav.reports'));
  const [tab, setTab] = useState('sales');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {t('nav.reports')}
        </h1>
        <p className="text-muted-foreground">{t('reports.subtitle')}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="sales">{t('reports.tabs.sales')}</TabsTrigger>
          <TabsTrigger value="profit">{t('reports.tabs.profit')}</TabsTrigger>
          <TabsTrigger value="tax">{t('reports.tabs.tax')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('reports.tabs.analytics')}</TabsTrigger>
          <TabsTrigger value="custom">{t('reports.tabs.custom')}</TabsTrigger>
          <TabsTrigger value="schedule">{t('reports.tabs.schedule')}</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesReportTab />
        </TabsContent>

        <TabsContent value="profit">
          <ProfitLossTab />
        </TabsContent>

        <TabsContent value="tax">
          <TaxReportTab />
        </TabsContent>

        <TabsContent value="analytics">
          <PlatformAnalyticsTab />
        </TabsContent>

        <TabsContent value="custom">
          <CustomReportsTab />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduledReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
