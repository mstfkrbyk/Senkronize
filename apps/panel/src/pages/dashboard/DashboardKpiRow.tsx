import { AlertTriangle, Clock, TrendingUp, Trophy } from 'lucide-react';
import type { ReactElement } from 'react';

import { KpiWidget } from '@/components/widgets/KpiWidget';
import type { DashboardApiSummary } from '@/types/dashboard-widgets';

interface Props {
  dash: DashboardApiSummary | undefined;
  loading: boolean;
}

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardKpiRow({ dash, loading }: Props): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiWidget
        title="Bugünkü gelir"
        value={dash ? formatTry(dash.revenueTry) : '—'}
        change={dash?.revenueDeltaPct ?? 0}
        changeCaption="düne göre"
        icon={TrendingUp}
        color="green"
        loading={loading}
      />
      <KpiWidget
        title="Bekleyen siparişler"
        value={dash?.pendingOrders ?? '—'}
        change={0}
        changeCaption="işlem bekliyor"
        icon={Clock}
        color="blue"
        loading={loading}
      />
      <KpiWidget
        title="Kritik stok uyarısı"
        value={dash?.lowStockCount ?? '—'}
        change={0}
        changeCaption="düşük stok kalemi"
        icon={AlertTriangle}
        color="yellow"
        href="/stock"
        loading={loading}
      />
      <KpiWidget
        title="BuyBox oranı"
        value={dash ? `${String(dash.buyboxWinRatePct)}%` : '—'}
        change={dash?.buyboxWinRateDeltaPct ?? 0}
        changeCaption="son 7 güne göre"
        icon={Trophy}
        color="purple"
        href="/pricing"
        loading={loading}
      />
    </div>
  );
}
