import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHasMarketplacePlatforms } from '@/hooks/useHasMarketplacePlatforms';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { useAuthStore } from '@/store/auth.store';

import { BuyBoxTab } from './BuyBoxTab';
import { CompetitorAnalysisTab } from './CompetitorAnalysisTab';
import { PriceHistoryTab } from './PriceHistoryTab';
import { PriceRulesTab } from './PriceRulesTab';
import { useRunPricing } from './hooks/usePricing';

function hasProAccess(plan: string | undefined): boolean {
  return plan === 'PRO' || plan === 'KURUMSAL';
}

export function PricingPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.pricing'));
  usePageTitle(t('pricing.pageTitle'));
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const proAccess = hasProAccess(plan);
  const showBuyBox = useHasMarketplacePlatforms();
  const runMutation = useRunPricing();
  const defaultTab = showBuyBox ? 'buybox' : 'rules';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pricing.title')}
        description={t('pricing.subtitle')}
        context={navContextLine}
        actions={
          <Button
            type="button"
            className="shrink-0 gap-2"
            disabled={runMutation.isPending || !proAccess}
            onClick={() => {
              runMutation.mutate();
            }}
          >
            {runMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {t('pricing.runEngine')}
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className={`grid w-full max-w-3xl ${showBuyBox ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {showBuyBox ? (
                <TabsTrigger value="buybox">{t('pricing.tabs.buybox')}</TabsTrigger>
              ) : null}
              <TabsTrigger value="rules">{t('pricing.tabs.rules')}</TabsTrigger>
              <TabsTrigger value="competitors">{t('pricing.tabs.competitors')}</TabsTrigger>
              <TabsTrigger value="history">{t('pricing.tabs.history')}</TabsTrigger>
            </TabsList>

            {showBuyBox ? (
              <TabsContent value="buybox" className="mt-6">
                <BuyBoxTab proAccess={proAccess} plan={plan} />
              </TabsContent>
            ) : null}

            <TabsContent value="rules" className="mt-6">
              <PriceRulesTab proAccess={proAccess} plan={plan} />
            </TabsContent>

            <TabsContent value="competitors" className="mt-6">
              <CompetitorAnalysisTab proAccess={proAccess} plan={plan} />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <PriceHistoryTab proAccess={proAccess} plan={plan} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
