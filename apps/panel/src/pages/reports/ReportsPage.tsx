import type { ReactElement } from 'react';
import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';

import { AnalyticsPage } from './AnalyticsPage';
import { CustomReportPage } from './CustomReportPage';
import { ProfitReportPage } from './ProfitReportPage';
import { ReportSchedulePage } from './ReportSchedulePage';
import { SalesReportTab } from './SalesReportTab';
import { SavedReportsList } from './SavedReportsList';
import { TaxReportPage } from './TaxReportPage';

export function ReportsPage(): ReactElement {
  usePageTitle('Raporlar');
  const [tab, setTab] = useState('sales');
  const [customSubTab, setCustomSubTab] = useState<'builder' | 'saved'>('builder');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Raporlar</h1>
        <p className="text-muted-foreground">
          Satış, kâr/zarar, vergi, analitik, özel raporlar ve zamanlanmış gönderimler.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="sales">Satış Raporu</TabsTrigger>
          <TabsTrigger value="profit">Kâr/Zarar</TabsTrigger>
          <TabsTrigger value="tax">Vergi</TabsTrigger>
          <TabsTrigger value="analytics">Analitik</TabsTrigger>
          <TabsTrigger value="custom">Özel Raporlar</TabsTrigger>
          <TabsTrigger value="schedule">Zamanlama</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesReportTab />
        </TabsContent>

        <TabsContent value="profit">
          <ProfitReportPage />
        </TabsContent>

        <TabsContent value="tax">
          <TaxReportPage />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsPage />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Tabs
            value={customSubTab}
            onValueChange={(v) => setCustomSubTab(v as 'builder' | 'saved')}
            className="space-y-4"
          >
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="builder">Rapor oluşturucu</TabsTrigger>
              <TabsTrigger value="saved">Kayıtlı raporlar</TabsTrigger>
            </TabsList>
            <TabsContent value="builder">
              <CustomReportPage />
            </TabsContent>
            <TabsContent value="saved">
              <SavedReportsList />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="schedule">
          <ReportSchedulePage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
