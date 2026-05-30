import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, ChevronDown, Filter } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ORDER_STATUS_LABEL_TR } from '@/lib/order-status';
import { INVOICE_STATUS_OPTIONS } from '@/pages/invoices/invoice-utils';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import {
  hasActiveOrderInvoiceFilters,
  type OrderInvoiceLinkFilter,
} from '@/pages/orders/order-invoice-filter';
import type { OrderFilters as OrderFiltersState, OrderStatus } from '@/types/order';

interface Props {
  filters: OrderFiltersState;
  onChange: (next: OrderFiltersState) => void;
  /** Yerel ön muhasebe (NATIVE) dışında fatura filtreleri gösterilmez. */
  showInvoiceFilters?: boolean;
  invoiceLink?: string;
  invoiceStatus?: string;
  onInvoiceFilterChange?: (patch: {
    invoiceLink?: string;
    invoiceStatus?: string;
  }) => void;
}

const DEFAULT_LIMIT = 20;

const ALL_STATUSES = Object.keys(ORDER_STATUS_LABEL_TR) as OrderStatus[];

function parseCsv(csv: string | undefined): string[] {
  if (!csv?.trim()) {
    return [];
  }
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function countActiveOrderFilters(
  f: OrderFiltersState,
  invoiceLink = 'all',
  invoiceStatus = 'all',
  includeInvoice = false,
): number {
  let n = 0;
  if (f.platforms?.trim() || f.platform) {
    n += 1;
  }
  if (f.statuses?.trim() || f.status) {
    n += 1;
  }
  if (f.startDate?.trim() || f.endDate?.trim()) {
    n += 1;
  }
  if (f.search?.trim()) {
    n += 1;
  }
  if (f.cargoProvider?.trim()) {
    n += 1;
  }
  if (f.minTotal !== undefined || f.maxTotal !== undefined) {
    n += 1;
  }
  if (includeInvoice && hasActiveOrderInvoiceFilters(invoiceLink, invoiceStatus)) {
    n += 1;
  }
  return n;
}

const INVOICE_LINK_OPTIONS: { value: OrderInvoiceLinkFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'orders.filters.invoiceLinkAll' },
  { value: 'linked', labelKey: 'orders.filters.invoiceLinkWith' },
  { value: 'unlinked', labelKey: 'orders.filters.invoiceLinkWithout' },
];

export function OrderFilters({
  filters,
  onChange,
  showInvoiceFilters = false,
  invoiceLink = 'all',
  invoiceStatus = 'all',
  onInvoiceFilterChange,
}: Props): ReactElement {
  const { t } = useTranslation();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const selectedPlatforms = useMemo(
    () => new Set(parseCsv(filters.platforms)),
    [filters.platforms],
  );
  const selectedStatuses = useMemo(
    () => new Set(parseCsv(filters.statuses)),
    [filters.statuses],
  );

  const activeCount = useMemo(
    () =>
      countActiveOrderFilters(
        filters,
        invoiceLink,
        invoiceStatus,
        showInvoiceFilters,
      ),
    [filters, invoiceLink, invoiceStatus, showInvoiceFilters],
  );

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

  const toggleInCsv = (
    key: 'platforms' | 'statuses',
    id: string,
    checked: boolean,
    legacyKey: 'platform' | 'status',
  ): void => {
    const cur =
      key === 'platforms'
        ? new Set(selectedPlatforms)
        : new Set(selectedStatuses);
    if (checked) {
      cur.add(id);
    } else {
      cur.delete(id);
    }
    const csv = [...cur].sort().join(',');
    onChange({
      ...filters,
      [key]: csv.length > 0 ? csv : undefined,
      [legacyKey]: undefined,
      page: 1,
    });
  };

  const handleClear = (): void => {
    onChange({ page: 1, limit: filters.limit ?? DEFAULT_LIMIT });
  };

  const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
  const endDate = filters.endDate ? new Date(filters.endDate) : undefined;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          Filtreler
          {activeCount > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {activeCount}
            </Badge>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          Filtreleri temizle
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="grid gap-2 min-w-[200px]">
          <Label>Pazaryeri (çoklu)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="justify-between font-normal"
              >
                {selectedPlatforms.size === 0
                  ? 'Tümü'
                  : `${String(selectedPlatforms.size)} seçili`}
                <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="max-h-64 overflow-y-auto p-2">
                {MARKETPLACE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedPlatforms.has(opt.id)}
                      onCheckedChange={(v) => {
                        toggleInCsv('platforms', opt.id, v === true, 'platform');
                      }}
                    />
                    <span className="text-sm">
                      <span className="mr-1" aria-hidden>
                        {opt.logo}
                      </span>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2 min-w-[200px]">
          <Label>Durum (çoklu)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="justify-between font-normal"
              >
                {selectedStatuses.size === 0
                  ? 'Tümü'
                  : `${String(selectedStatuses.size)} seçili`}
                <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="max-h-64 overflow-y-auto p-2">
                {ALL_STATUSES.map((st) => (
                  <label
                    key={st}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedStatuses.has(st)}
                      onCheckedChange={(v) => {
                        toggleInCsv('statuses', st, v === true, 'status');
                      }}
                    />
                    <span className="text-sm">{ORDER_STATUS_LABEL_TR[st]}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2 min-w-[140px]">
          <Label>Başlangıç tarihi</Label>
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="justify-start font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" aria-hidden />
                {startDate
                  ? format(startDate, 'd MMM yyyy', { locale: tr })
                  : 'Seç'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => {
                  setField('startDate', d ? format(d, 'yyyy-MM-dd') : undefined);
                  setStartOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2 min-w-[140px]">
          <Label>Bitiş tarihi</Label>
          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="justify-start font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" aria-hidden />
                {endDate
                  ? format(endDate, 'd MMM yyyy', { locale: tr })
                  : 'Seç'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => {
                  setField('endDate', d ? format(d, 'yyyy-MM-dd') : undefined);
                  setEndOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2 min-w-[160px] flex-1">
          <Label htmlFor="order-cargo">Kargo firması</Label>
          <Input
            id="order-cargo"
            placeholder="Örn. Aras, Yurtiçi"
            value={filters.cargoProvider ?? ''}
            onChange={(e) =>
              setField(
                'cargoProvider',
                e.target.value.trim() ? e.target.value : undefined,
              )
            }
          />
        </div>

        <div className="grid gap-2 w-[120px]">
          <Label htmlFor="order-min-total">Min. tutar</Label>
          <Input
            id="order-min-total"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={filters.minTotal ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setField('minTotal', v === '' ? undefined : Number(v.replace(',', '.')));
            }}
          />
        </div>
        <div className="grid gap-2 w-[120px]">
          <Label htmlFor="order-max-total">Max. tutar</Label>
          <Input
            id="order-max-total"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={filters.maxTotal ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setField('maxTotal', v === '' ? undefined : Number(v.replace(',', '.')));
            }}
          />
        </div>

        <div className="grid gap-2 min-w-[200px] flex-1">
          <Label htmlFor="order-search">Ara</Label>
          <Input
            id="order-search"
            placeholder="Müşteri veya sipariş no"
            value={filters.search ?? ''}
            onChange={(e) =>
              setField('search', e.target.value.trim() ? e.target.value : undefined)
            }
          />
        </div>

        {showInvoiceFilters ? (
          <>
            <div className="grid gap-2 min-w-[180px]">
              <Label htmlFor="order-invoice-link">{t('orders.filters.invoiceLink')}</Label>
              <select
                id="order-invoice-link"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={invoiceLink}
                onChange={(e) => {
                  onInvoiceFilterChange?.({ invoiceLink: e.target.value });
                }}
              >
                {INVOICE_LINK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 min-w-[180px]">
              <Label htmlFor="order-invoice-status">
                {t('orders.filters.invoiceStatus')}
              </Label>
              <select
                id="order-invoice-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={invoiceStatus}
                onChange={(e) => {
                  onInvoiceFilterChange?.({ invoiceStatus: e.target.value });
                }}
              >
                <option value="all">{t('orders.filters.invoiceStatusAll')}</option>
                {INVOICE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
