import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/PageHeader';
import { QuickStockSearch } from '@/components/QuickStockSearch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/store/auth.store';

import { formatStockNavContext } from './stock-nav-context';
import { StockForecastTab } from './components/StockForecastTab';
import { StockKpiRow } from './components/StockKpiRow';
import { StockQuickActions } from './components/StockQuickActions';
import { StockStatusTab } from './components/StockStatusTab';
import { WarehousesTab } from './components/WarehousesTab';
import { useStockKpis } from './hooks/useStockKpis';
import { StockMovementsTab } from './StockMovementPage';
import { StockTransfersTab } from './StockTransferPage';
import {
  defaultStockTab,
  getStockTabDefinition,
  isStockTabId,
  resolveStockSubtitleKey,
  STOCK_TABS,
  type StockTabId,
} from './stock-tabs.config';

function StockTabCardDescription({
  tabId,
}: {
  tabId: StockTabId;
}): ReactElement | null {
  const { t } = useTranslation();
  const cardDescKey = getStockTabDefinition(tabId).cardDescKey;
  if (!cardDescKey) {
    return null;
  }
  return <CardDescription>{t(cardDescKey)}</CardDescription>;
}

export function StockPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel, pageLabel } = useActiveNav();
  usePageTitle(t('stock.title'));

  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const navContext = formatStockNavContext(
    groupLabel,
    pageLabel ?? t('nav.stock'),
    orgProducts,
    accountingMode,
    t,
  );
  const subtitleKey = useMemo(
    () => resolveStockSubtitleKey(orgProducts, accountingMode),
    [orgProducts, accountingMode],
  );

  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const [tab, setTab] = useState<StockTabId>(
    isStockTabId(tabParam) ? tabParam : defaultStockTab(),
  );

  const { metrics, loading, errorMessage } = useStockKpis();

  useEffect(() => {
    if (isStockTabId(tabParam) && tabParam !== tab) {
      setTab(tabParam);
    }
  }, [tabParam, tab]);

  const onTabChange = (value: string): void => {
    if (!isStockTabId(value)) {
      return;
    }
    setTab(value);
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('stock.title')}
        description={t(subtitleKey)}
        context={navContext}
      />

      <StockKpiRow
        metrics={metrics}
        loading={loading}
        errorMessage={errorMessage}
      />

      <QuickStockSearch
        variant="inline"
        placeholder={t('stock.quickSearch.placeholder')}
      />

      <StockQuickActions />

      <Tabs value={tab} onValueChange={onTabChange} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {STOCK_TABS.map(({ id, labelKey }) => (
            <TabsTrigger key={id} value={id}>
              {t(labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>{t(getStockTabDefinition('status').labelKey)}</CardTitle>
              <StockTabCardDescription tabId="status" />
            </CardHeader>
            <CardContent>
              <StockStatusTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouses">
          <Card>
            <CardHeader>
              <CardTitle>{t(getStockTabDefinition('warehouses').labelKey)}</CardTitle>
              <StockTabCardDescription tabId="warehouses" />
            </CardHeader>
            <CardContent>
              <WarehousesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <StockMovementsTab embedded />
        </TabsContent>

        <TabsContent value="transfers">
          <Card>
            <CardHeader>
              <CardTitle>{t(getStockTabDefinition('transfers').labelKey)}</CardTitle>
              <StockTabCardDescription tabId="transfers" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <StockTransfersTab embedded />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle>{t(getStockTabDefinition('forecast').labelKey)}</CardTitle>
              <StockTabCardDescription tabId="forecast" />
            </CardHeader>
            <CardContent>
              <StockForecastTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
