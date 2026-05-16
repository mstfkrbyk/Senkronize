import type { ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

import { BuyBoxDashboard } from './BuyBoxDashboard';
import { CreateRuleDialog } from './CreateRuleDialog';
import { PriceHistoryTable } from './PriceHistoryTable';
import { PricingRuleCard } from './PricingRuleCard';
import {
  useBuyBoxSummary,
  usePriceHistory,
  usePricingRules,
  useRunPricing,
} from './hooks/usePricing';

function hasProAccess(plan: string | undefined): boolean {
  return plan === 'PRO' || plan === 'KURUMSAL';
}

export function PricingPage(): ReactElement {
  const navigate = useNavigate();
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const [createOpen, setCreateOpen] = useState(false);

  const buyBoxQuery = useBuyBoxSummary();
  const rulesQuery = usePricingRules();
  const historyQuery = usePriceHistory();
  const runMutation = useRunPricing();

  if (!hasProAccess(plan)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" aria-hidden />
        <h2 className="text-xl font-semibold text-primary">
          Bu özellik PRO pakette mevcuttur
        </h2>
        <p className="max-w-md text-muted-foreground">
          Otomatik BuyBox optimizasyonu ile rakiplerinizin önüne geçin.
        </p>
        <Button
          type="button"
          onClick={() => {
            navigate('/settings/subscription');
          }}
        >
          Paketi yükselt
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Fiyatlandırma ve BuyBox
          </h1>
          <p className="text-muted-foreground">
            Kurallarınızı yönetin, motoru çalıştırın ve fiyat geçmişini izleyin.
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 gap-2"
          disabled={runMutation.isPending}
          onClick={() => {
            runMutation.mutate();
          }}
        >
          {runMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Motoru çalıştır
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-primary">BuyBox özeti</h2>
        <BuyBoxDashboard summaryQuery={buyBoxQuery} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium text-primary">Aktif kurallar</h2>
          <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
            Yeni kural ekle
          </Button>
        </div>

        {rulesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Kurallar yükleniyor…</p>
        ) : null}
        {rulesQuery.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {getApiErrorMessage(rulesQuery.error)}
          </div>
        ) : null}
        {!rulesQuery.isLoading &&
        !rulesQuery.isError &&
        (rulesQuery.data?.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            Henüz fiyat kuralı yok. Yeni kural ekleyerek başlayın.
          </p>
        ) : null}
        {!rulesQuery.isLoading && !rulesQuery.isError && rulesQuery.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rulesQuery.data.map((rule) => (
              <PricingRuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-primary">Fiyat geçmişi</h2>
        <p className="text-sm text-muted-foreground">Son 20 değişiklik</p>
        <PriceHistoryTable query={historyQuery} />
      </section>

      <CreateRuleDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
