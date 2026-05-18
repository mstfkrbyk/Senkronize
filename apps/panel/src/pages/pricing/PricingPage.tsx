import type { ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from '@/components/TableSkeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { useListings } from '@/pages/listings/hooks/useListings';
import { useAuthStore } from '@/store/auth.store';

import { BuyBoxDashboard } from './BuyBoxDashboard';
import { CreateRuleDialog } from './CreateRuleDialog';
import { PriceHistoryTable } from './PriceHistoryTable';
import { PricingRuleCard } from './PricingRuleCard';
import {
  useBuyBoxListingAnalysis,
  useBuyBoxSummary,
  useBuyBoxWinRate,
  usePriceHistory,
  usePricingRules,
  useRunPricing,
} from './hooks/usePricing';

function hasProAccess(plan: string | undefined): boolean {
  return plan === 'PRO' || plan === 'KURUMSAL';
}

export function PricingPage(): ReactElement {
  usePageTitle('Fiyatlandırma');
  const navigate = useNavigate();
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const [createOpen, setCreateOpen] = useState(false);
  const [analysisListingId, setAnalysisListingId] = useState<string>('');

  const buyBoxQuery = useBuyBoxSummary();
  const winRateQuery = useBuyBoxWinRate(7);
  const listingsPickerQuery = useListings({ page: 1, limit: 100 });
  const listingAnalysisQuery = useBuyBoxListingAnalysis(
    analysisListingId === '' ? null : analysisListingId,
  );
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
        <h2 className="text-lg font-medium text-primary">Win rate (son 7 gün)</h2>
        <p className="text-sm text-muted-foreground">
          Tüm platformlardaki BuyBox anlık görüntülerine göre kazanma oranı.
        </p>
        {winRateQuery.isLoading ? (
          <Skeleton className="h-36 w-full rounded-lg" />
        ) : null}
        {winRateQuery.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {getApiErrorMessage(winRateQuery.error)}
          </div>
        ) : null}
        {winRateQuery.data ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                BuyBox kazanma oranı
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-3xl font-semibold text-sky-600">
                  %{(winRateQuery.data.winRate * 100).toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {winRateQuery.data.winCount} / {winRateQuery.data.totalChecks} kontrol
                </p>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(winRateQuery.data.winRate * 1000) / 10}
              >
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, winRateQuery.data.winRate * 100))}%`,
                  }}
                />
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Kazanırken ort. fiyat</p>
                  <p className="font-medium tabular-nums">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      maximumFractionDigits: 2,
                    }).format(winRateQuery.data.avgPriceWhenWinning)}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Kaybederken ort. fiyat</p>
                  <p className="font-medium tabular-nums">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      maximumFractionDigits: 2,
                    }).format(winRateQuery.data.avgPriceWhenLosing)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-primary">Listing analizi</h2>
        <p className="text-sm text-muted-foreground">
          Bir listeleme seçerek BuyBox fiyat farkı ve öneriyi görüntüleyin.
        </p>
        <div className="max-w-xl space-y-4">
          {listingsPickerQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : null}
          {listingsPickerQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {getApiErrorMessage(listingsPickerQuery.error)}
            </div>
          ) : null}
          {listingsPickerQuery.data && listingsPickerQuery.data.items.length > 0 ? (
            <Select
              value={analysisListingId === '' ? undefined : analysisListingId}
              onValueChange={(v) => {
                setAnalysisListingId(v);
              }}
            >
              <SelectTrigger aria-label="Listeleme seç">
                <SelectValue placeholder="Listeleme seçin" />
              </SelectTrigger>
              <SelectContent>
                {listingsPickerQuery.data.items.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title.slice(0, 60)}
                    {l.title.length > 60 ? '…' : ''} — {l.platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {listingsPickerQuery.data && listingsPickerQuery.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Gösterilecek listeleme yok.</p>
          ) : null}

          {analysisListingId === '' ? (
            <p className="text-sm text-muted-foreground">
              Analiz için yukarıdan bir listeleme seçin.
            </p>
          ) : null}

          {listingAnalysisQuery.isLoading && analysisListingId !== '' ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : null}
          {listingAnalysisQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {getApiErrorMessage(listingAnalysisQuery.error)}
            </div>
          ) : null}
          {listingAnalysisQuery.data ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Özet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Satış fiyatı</span>
                  <span className="font-medium tabular-nums">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                    }).format(listingAnalysisQuery.data.currentPrice)}
                  </span>
                </div>
                {listingAnalysisQuery.data.buyBoxPrice != null ? (
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-muted-foreground">BuyBox fiyatı</span>
                    <span className="font-medium tabular-nums">
                      {new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                      }).format(listingAnalysisQuery.data.buyBoxPrice)}
                    </span>
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">BuyBox sende</span>
                  <span className="font-medium">
                    {listingAnalysisQuery.data.hasBuyBox ? 'Evet' : 'Hayır'}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Fiyat farkı (biz − BuyBox)</span>
                  <span className="font-medium tabular-nums">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      signDisplay: 'exceptZero',
                    }).format(listingAnalysisQuery.data.priceGap)}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Önerilen fiyat</span>
                  <span className="font-semibold text-sky-700 tabular-nums">
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                    }).format(listingAnalysisQuery.data.suggestedPrice)}
                  </span>
                </div>
                {listingAnalysisQuery.data.competitorPrices.length > 0 ? (
                  <div>
                    <p className="text-muted-foreground">Referans rakip fiyatları</p>
                    <p className="font-medium tabular-nums">
                      {listingAnalysisQuery.data.competitorPrices
                        .map((p) =>
                          new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                          }).format(p),
                        )
                        .join(' · ')}
                    </p>
                  </div>
                ) : null}
                <p className="border-t pt-3 text-muted-foreground leading-relaxed">
                  {listingAnalysisQuery.data.recommendation}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium text-primary">Aktif kurallar</h2>
          <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
            Yeni kural ekle
          </Button>
        </div>

        {rulesQuery.isLoading ? (
          <TableSkeleton rows={4} cols={3} />
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
