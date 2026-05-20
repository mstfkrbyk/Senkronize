import type { ReactElement } from 'react';
import { useState } from 'react';
import { CalendarClock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';

import { CustomReportPage } from './CustomReportPage';
import { ProfitReportPage } from './ProfitReportPage';
import { ReportScheduleModal } from './ReportScheduleModal';
import { ReportSchedulePage } from './ReportSchedulePage';
import { SalesReportTab } from './SalesReportTab';
import { SavedReportsList } from './SavedReportsList';

export function ReportsPage(): ReactElement {
  usePageTitle('Raporlar');
  const [mainTab, setMainTab] = useState<'standard' | 'custom' | 'schedule'>('standard');
  const [standardTab, setStandardTab] = useState('sales');
  const [customSubTab, setCustomSubTab] = useState<'builder' | 'saved'>('builder');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Raporlar</h1>
          <p className="text-muted-foreground">
            Satış, kâr/zarar, özel raporlar ve zamanlanmış gönderimler.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setScheduleOpen(true)}
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          Rapor Planla
        </Button>
      </div>

      <ReportScheduleModal open={scheduleOpen} onOpenChange={setScheduleOpen} />

      <Tabs
        value={mainTab}
        onValueChange={(v) => setMainTab(v as 'standard' | 'custom' | 'schedule')}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="standard">Standart raporlar</TabsTrigger>
          <TabsTrigger value="custom">Özel raporlar</TabsTrigger>
          <TabsTrigger value="schedule">Rapor takvimi</TabsTrigger>
        </TabsList>

        <TabsContent value="standard" className="space-y-4">
          <Tabs value={standardTab} onValueChange={setStandardTab} className="space-y-4">
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="sales">Satış raporu</TabsTrigger>
              <TabsTrigger value="profit">Kâr / zarar</TabsTrigger>
            </TabsList>
            <TabsContent value="sales">
              <SalesReportTab />
            </TabsContent>
            <TabsContent value="profit">
              <ProfitReportPage />
            </TabsContent>
          </Tabs>
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
