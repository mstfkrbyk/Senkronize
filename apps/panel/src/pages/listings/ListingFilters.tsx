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
import type { ListingFilters as ListingFiltersState } from '@/types/listing';

interface Props {
  filters: ListingFiltersState;
  onChange: (next: ListingFiltersState) => void;
  /** Debounced arama için üst bileşenden kontrollü metin */
  searchInput?: string;
  onSearchInputChange?: (value: string) => void;
}

const DEFAULT_LIMIT = 20;

export function ListingFilters({
  filters,
  onChange,
  searchInput,
  onSearchInputChange,
}: Props): ReactElement {
  const setField = <K extends keyof ListingFiltersState>(
    key: K,
    value: ListingFiltersState[K] | undefined,
  ): void => {
    onChange({
      ...filters,
      [key]: value,
      page: 1,
    });
  };

  const handleClear = (): void => {
    onSearchInputChange?.('');
    onChange({ page: 1, limit: DEFAULT_LIMIT });
  };

  const searchControlled =
    searchInput !== undefined && onSearchInputChange !== undefined;

  const approvedValue =
    filters.approved === undefined
      ? 'all'
      : filters.approved
        ? 'approved'
        : 'pending';

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:flex-wrap md:items-end">
      <div className="grid gap-2 md:min-w-[160px]">
        <Label htmlFor="listing-platform">Pazaryeri</Label>
        <Select
          value={filters.platform ?? 'all'}
          onValueChange={(v) =>
            setField('platform', v === 'all' ? undefined : v)
          }
        >
          <SelectTrigger id="listing-platform">
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
        <Label htmlFor="listing-approved">Onay durumu</Label>
        <Select
          value={approvedValue}
          onValueChange={(v) => {
            if (v === 'all') {
              setField('approved', undefined);
            } else if (v === 'approved') {
              setField('approved', true);
            } else {
              setField('approved', false);
            }
          }}
        >
          <SelectTrigger id="listing-approved">
            <SelectValue placeholder="Tümü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="approved">Onaylı</SelectItem>
            <SelectItem value="pending">Beklemede</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid min-w-0 flex-1 gap-2 md:min-w-[200px]">
        <Label htmlFor="listing-search">Ara</Label>
        <Input
          id="listing-search"
          placeholder="Ürün adı veya barkod"
          value={searchControlled ? searchInput : (filters.search ?? '')}
          onChange={(e) => {
            const v = e.target.value;
            if (searchControlled) {
              onSearchInputChange(v);
            } else {
              setField('search', v ? v : undefined);
            }
          }}
        />
      </div>

      <Button type="button" variant="outline" onClick={handleClear}>
        Temizle
      </Button>
    </div>
  );
}
