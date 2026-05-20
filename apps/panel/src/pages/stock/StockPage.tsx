import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { QuickStockSearch } from '@/components/QuickStockSearch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';

import { StockForecastTab } from './components/StockForecastTab';
import { StockKpiRow } from './components/StockKpiRow';
import { StockQuickActions } from './components/StockQuickActions';
import { StockStatusTab } from './components/StockStatusTab';
import { WarehousesTab } from './components/WarehousesTab';
import { useStockKpis } from './hooks/useStockKpis';
import { StockMovementsTab } from './StockMovementPage';
import { StockTransfersTab } from './StockTransferPage';

const TAB_VALUES = [
  'status',
  'warehouses',
  'movements',
  'transfers',
  'forecast',
] as const;

type StockTab = (typeof TAB_VALUES)[number];

function isStockTab(value: string | null): value is StockTab {
  return value !== null && TAB_VALUES.includes(value as StockTab);
}

export function StockPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('stock.title'));

  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const [tab, setTab] = useState<StockTab>(
    isStockTab(tabParam) ? tabParam : 'status',
  );

  const { metrics, loading } = useStockKpis();

  useEffect(() => {
    if (isStockTab(tabParam) && tabParam !== tab) {
      setTab(tabParam);
    }
  }, [tabParam, tab]);

  const onTabChange = (value: string): void => {
    if (!isStockTab(value)) {
      return;
    }
    setTab(value);
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {t('stock.title')}
        </h1>
        <p className="text-muted-foreground">{t('stock.subtitle')}</p>
      </div>

      <StockKpiRow metrics={metrics} loading={loading} />

      <QuickStockSearch
        variant="inline"
        placeholder={t('stock.quickSearch.placeholder')}
      />

      <StockQuickActions />

      <Tabs value={tab} onValueChange={onTabChange} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="status">{t('stock.tabs.status')}</TabsTrigger>
          <TabsTrigger value="warehouses">{t('stock.tabs.warehouses')}</TabsTrigger>
          <TabsTrigger value="movements">{t('stock.tabs.movements')}</TabsTrigger>
          <TabsTrigger value="transfers">{t('stock.tabs.transfers')}</TabsTrigger>
          <TabsTrigger value="forecast">{t('stock.tabs.forecast')}</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>{t('stock.tabs.status')}</CardTitle>
              <CardDescription>{t('stock.status.cardDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <StockStatusTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouses">
          <Card>
            <CardHeader>
              <CardTitle>{t('stock.tabs.warehouses')}</CardTitle>
              <CardDescription>{t('stock.warehouses.cardDesc')}</CardDescription>
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
              <CardTitle>{t('stock.tabs.transfers')}</CardTitle>
              <CardDescription>{t('stock.transfers.cardDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <StockTransfersTab embedded />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle>{t('stock.tabs.forecast')}</CardTitle>
              <CardDescription>{t('stock.forecast.cardDesc')}</CardDescription>
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
