import type { ReactElement } from 'react';
import { useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';

import { StockKpiRow } from './components/StockKpiRow';
import { StockOverviewTable } from './components/StockOverviewTable';
import { StockQuickActions } from './components/StockQuickActions';
import { useStockKpis } from './hooks/useStockKpis';

export function StockPage(): ReactElement {
  usePageTitle('Stok yönetimi');
  const [params] = useSearchParams();
  const initialWarehouse = params.get('warehouse') ?? undefined;

  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | undefined>(
    initialWarehouse,
  );
  const [statusFilter, setStatusFilter] = useState('');

  const { metrics, loading } = useStockKpis();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Stok yönetimi
        </h1>
        <p className="text-muted-foreground">
          Depo bazlı stok seviyelerini izleyin, kritik ürünleri takip edin ve
          hızlı aksiyon alın.
        </p>
      </div>

      <StockKpiRow metrics={metrics} loading={loading} />

      <StockQuickActions />

      <Card>
        <CardHeader>
          <CardTitle>Stok listesi</CardTitle>
          <CardDescription>
            Ürün bazında depo dağılımı, eşik değerleri ve son hareketler
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StockOverviewTable
            search={search}
            warehouseId={warehouseId}
            statusFilter={statusFilter === '__all__' ? '' : statusFilter}
            onSearchChange={setSearch}
            onWarehouseChange={setWarehouseId}
            onStatusFilterChange={(v) =>
              setStatusFilter(v === '__all__' ? '' : v)
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
