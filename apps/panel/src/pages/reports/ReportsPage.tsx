import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { useAuthStore } from '@/store/auth.store';

import { CustomReportsTab } from './CustomReportsTab';
import { ErpTransferReport } from './ErpTransferReport';
import { PlatformAnalyticsTab } from './PlatformAnalyticsTab';
import { ProfitLossTab } from './ProfitLossTab';
import { SalesReportTab } from './SalesReportTab';
import { ScheduledReportsTab } from './ScheduledReportsTab';
import { TaxReportTab } from './TaxReportTab';
import {
  defaultReportTab,
  isReportTabId,
  resolveReportsProductAccess,
  resolveReportsSubtitleKey,
  resolveReportsTabs,
  type ReportTabId,
} from './reports-tabs.config';

export function ReportsPage(): ReactElement {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { groupLabel } = useActiveNav();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();

  const pageTitle = t('nav.reports');

  const productAccess = useMemo(
    () => resolveReportsProductAccess(orgProducts),
    [orgProducts],
  );

  const tabs = useMemo(
    () => resolveReportsTabs(orgProducts, accountingMode),
    [orgProducts, accountingMode],
  );

  const subtitleKey = useMemo(() => {
    if (accountingModeLoading && productAccess.hasAccounting) {
      return null;
    }
    return resolveReportsSubtitleKey(productAccess, accountingMode);
  }, [accountingModeLoading, productAccess, accountingMode]);

  const subtitle =
    subtitleKey != null ? t(subtitleKey) : null;

  const defaultTab = useMemo(() => defaultReportTab(tabs), [tabs]);
  const [tab, setTab] = useState<ReportTabId>(defaultTab);

  const navContextLine = useMemo(() => {
    if (tab === 'schedule') {
      return formatNavPageContext(pageTitle, t('reports.schedule.contextLabel'));
    }
    return formatNavPageContext(groupLabel, pageTitle);
  }, [tab, groupLabel, pageTitle, t]);

  usePageTitle(pageTitle);

  useEffect(() => {
    if (!isReportTabId(tab, tabs)) {
      setTab(defaultReportTab(tabs));
    }
  }, [tab, tabs]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (!isReportTabId(tabParam, tabs)) {
      return;
    }
    setTab(tabParam);
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, tabs]);

  if (accountingModeLoading && tabs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={pageTitle}
          description={subtitle ?? undefined}
          context={navContextLine}
        />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  const visibleTabIds = new Set(tabs.map((item) => item.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description={subtitle ?? undefined}
        context={navContextLine}
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isReportTabId(value, tabs)) {
            setTab(value);
          }
        }}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap gap-1">
          {tabs.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {t(item.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabIds.has('sales') ? (
          <TabsContent value="sales">
            <SalesReportTab />
          </TabsContent>
        ) : null}

        {visibleTabIds.has('profit') ? (
          <TabsContent value="profit">
            <ProfitLossTab />
          </TabsContent>
        ) : null}

        {visibleTabIds.has('tax') ? (
          <TabsContent value="tax">
            <TaxReportTab />
          </TabsContent>
        ) : null}

        {visibleTabIds.has('analytics') ? (
          <TabsContent value="analytics">
            <PlatformAnalyticsTab />
          </TabsContent>
        ) : null}

        {visibleTabIds.has('custom') ? (
          <TabsContent value="custom">
            <CustomReportsTab />
          </TabsContent>
        ) : null}

        {visibleTabIds.has('schedule') ? (
          <TabsContent value="schedule">
            <ScheduledReportsTab />
          </TabsContent>
        ) : null}

        {visibleTabIds.has('erp-transfer') ? (
          <TabsContent value="erp-transfer">
            <ErpTransferReport />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
