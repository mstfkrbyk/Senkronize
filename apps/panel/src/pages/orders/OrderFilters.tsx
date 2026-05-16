import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OrderFilters as OrderFiltersState } from '@/types/order';

interface Props {
  filters: OrderFiltersState;
  onChange: (next: OrderFiltersState) => void;
}

const DEFAULT_LIMIT = 20;

export function OrderFilters({ filters, onChange }: Props): ReactElement {
  const setField = <K extends keyof OrderFiltersState>(
    key: K,
    value: OrderFiltersState[K] | undefined,
  ): void => {
    onChange({
      ...filters,
      [key]: value,
      page: 1,
    });
  };

  const handleClear = (): void => {
    onChange({ page: 1, limit: DEFAULT_LIMIT });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:flex-wrap md:items-end">
      <div className="grid gap-2 md:min-w-[160px]">
        <Label htmlFor="order-platform">Pazaryeri</Label>
        <Select
          value={filters.platform ?? 'all'}
          onValueChange={(v) =>
            setField('platform', v === 'all' ? undefined : v)
          }
        >
          <SelectTrigger id="order-platform">
            <SelectValue placeholder="Tümü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="TRENDYOL">Trendyol</SelectItem>
            <SelectItem value="HEPSIBURADA">Hepsiburada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 md:min-w-[160px]">
        <Label htmlFor="order-status">Durum</Label>
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(v) =>
            setField('status', v === 'all' ? undefined : v)
          }
        >
          <SelectTrigger id="order-status">
            <SelectValue placeholder="Tümü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="NEW">Yeni</SelectItem>
            <SelectItem value="SHIPPED">Kargoda</SelectItem>
            <SelectItem value="DELIVERED">Teslim Edildi</SelectItem>
            <SelectItem value="CANCELLED">İptal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 md:min-w-[140px]">
        <Label htmlFor="order-start">Başlangıç</Label>
        <Input
          id="order-start"
          type="date"
          value={filters.startDate ?? ''}
          onChange={(e) =>
            setField(
              'startDate',
              e.target.value ? e.target.value : undefined,
            )
          }
        />
      </div>

      <div className="grid gap-2 md:min-w-[140px]">
        <Label htmlFor="order-end">Bitiş</Label>
        <Input
          id="order-end"
          type="date"
          value={filters.endDate ?? ''}
          onChange={(e) =>
            setField('endDate', e.target.value ? e.target.value : undefined)
          }
        />
      </div>

      <div className="grid min-w-0 flex-1 gap-2 md:min-w-[200px]">
        <Label htmlFor="order-search">Ara</Label>
        <Input
          id="order-search"
          placeholder="Müşteri veya sipariş no"
          value={filters.search ?? ''}
          onChange={(e) =>
            setField('search', e.target.value ? e.target.value : undefined)
          }
        />
      </div>

      <Button type="button" variant="outline" onClick={handleClear}>
        Temizle
      </Button>
    </div>
  );
}
