import type { ReactElement } from 'react';

import { AlertTriangle, Package, Trophy, TrendingDown } from 'lucide-react';

import { AnimatedKpiCard } from '@/components/dashboard/AnimatedKpiCard';

import { useListingKpis } from './hooks/useListings';

export function ListingsKpiRow(): ReactElement {
  const kpisQuery = useListingKpis();
  const data = kpisQuery.data;
  const loading = kpisQuery.isLoading;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <AnimatedKpiCard
        title="Toplam aktif listing"
        numericValue={data?.activeCount ?? 0}
        format="integer"
        change={0}
        changeCaption=""
        icon={Package}
        color="blue"
        loading={loading}
      />
      <AnimatedKpiCard
        title="Fiyat uyumsuzluğu"
        numericValue={data?.priceMismatchCount ?? 0}
        format="integer"
        change={0}
        changeCaption=""
        icon={TrendingDown}
        color="yellow"
        loading={loading}
      />
      <AnimatedKpiCard
        title="Stok uyumsuzluğu"
        numericValue={data?.stockMismatchCount ?? 0}
        format="integer"
        change={0}
        changeCaption=""
        icon={AlertTriangle}
        color="red"
        loading={loading}
      />
      <AnimatedKpiCard
        title="BuyBox kazanma oranı"
        numericValue={data?.buyBoxWinRatePct ?? 0}
        format="percent"
        change={0}
        changeCaption=""
        icon={Trophy}
        color="purple"
        loading={loading}
      />
    </div>
  );
}
