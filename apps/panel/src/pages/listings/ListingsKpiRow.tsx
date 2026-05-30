import type { ReactElement } from 'react';

import { AlertTriangle, Package, Trophy, TrendingDown } from 'lucide-react';

import { AnimatedKpiCard } from '@/components/dashboard/AnimatedKpiCard';
import { Skeleton } from '@/components/ui/skeleton';

import { useListingKpis } from './hooks/useListings';

interface Props {
  showBuyBox?: boolean;
}

export function ListingsKpiRow({ showBuyBox = true }: Props): ReactElement {
  const kpisQuery = useListingKpis();
  const data = kpisQuery.data;
  const loading = kpisQuery.isLoading;

  if (loading) {
    return (
      <div className={`grid grid-cols-2 gap-4 ${showBuyBox ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {Array.from({ length: showBuyBox ? 4 : 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-4 ${showBuyBox ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      <AnimatedKpiCard
        title="Toplam aktif listing"
        numericValue={data?.activeCount ?? 0}
        format="integer"
        change={0}
        changeCaption=""
        icon={Package}
        color="blue"
      />
      <AnimatedKpiCard
        title="Fiyat uyumsuzluğu"
        numericValue={data?.priceMismatchCount ?? 0}
        format="integer"
        change={0}
        changeCaption=""
        icon={TrendingDown}
        color="yellow"
      />
      <AnimatedKpiCard
        title="Stok uyumsuzluğu"
        numericValue={data?.stockMismatchCount ?? 0}
        format="integer"
        change={0}
        changeCaption=""
        icon={AlertTriangle}
        color="red"
      />
      {showBuyBox ? (
        <AnimatedKpiCard
          title="BuyBox kazanma oranı"
          numericValue={data?.buyBoxWinRatePct ?? 0}
          format="percent"
          change={0}
          changeCaption=""
          icon={Trophy}
          color="purple"
        />
      ) : null}
    </div>
  );
}
