import type { ReactElement } from 'react';

import { Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StockKpiRow } from '@/pages/stock/components/StockKpiRow';
import { useStockKpis } from '@/pages/stock/hooks/useStockKpis';
import { useNativeInventoryValuationEnabled } from '@/pages/stock/hooks/useInventoryValuation';

export function AccountingNativeStockSection(): ReactElement | null {
  const { t } = useTranslation();
  const { enabled: isNative, isLoading: modeLoading } =
    useNativeInventoryValuationEnabled();
  const { metrics, loading, errorMessage } = useStockKpis();

  if (modeLoading || !isNative) {
    return null;
  }

  const showStockCta = !loading && metrics.totalSkuCount === 0;

  return (
    <section className="space-y-4" aria-labelledby="accounting-stock-section-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="accounting-stock-section-title"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            {t('accounting.stockSectionTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('accounting.stockSectionHint')}</p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link to="/products?tab=warehouses">{t('accounting.inventoryValuationLink')}</Link>
        </Button>
      </div>

      {showStockCta ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />
              {t('accounting.stockEmptyTitle')}
            </CardTitle>
            <CardDescription>{t('accounting.stockEmptyDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/products?tab=status">{t('accounting.goToStockManagement')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <StockKpiRow metrics={metrics} loading={loading} errorMessage={errorMessage} />
      )}
    </section>
  );
}
