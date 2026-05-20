import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
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
  usePageTitle(t('pricing.pageTitle'));
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const proAccess = hasProAccess(plan);
  const runMutation = useRunPricing();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            {t('pricing.title')}
          </h1>
          <p className="text-muted-foreground">{t('pricing.subtitle')}</p>
        </div>
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
      </div>

      <Tabs defaultValue="buybox" className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="buybox">{t('pricing.tabs.buybox')}</TabsTrigger>
          <TabsTrigger value="rules">{t('pricing.tabs.rules')}</TabsTrigger>
          <TabsTrigger value="competitors">{t('pricing.tabs.competitors')}</TabsTrigger>
          <TabsTrigger value="history">{t('pricing.tabs.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="buybox" className="mt-6">
          <BuyBoxTab proAccess={proAccess} plan={plan} />
        </TabsContent>

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
    </div>
  );
}
