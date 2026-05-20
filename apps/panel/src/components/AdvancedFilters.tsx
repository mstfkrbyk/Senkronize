import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, ChevronDown, Filter, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'date_range' | 'number_range' | 'text' | 'multi_select';
  options?: { value: string; label: string }[];
  /** number_range / date_range için ikinci alan anahtarı */
  rangeEndKey?: string;
  placeholder?: string;
}

interface AdvancedFiltersProps {
  filters: FilterConfig[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onReset: () => void;
}

function isActiveFilterValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
}

function formatBadgeValue(
  config: FilterConfig,
  value: unknown,
  values: Record<string, unknown>,
): string {
  if (config.type === 'multi_select' && Array.isArray(value)) {
    const labels = value
      .map((v) => config.options?.find((o) => o.value === v)?.label ?? v)
      .slice(0, 2);
    const extra = value.length - labels.length;
    return extra > 0 ? `${labels.join(', ')} +${String(extra)}` : labels.join(', ');
  }
  if (config.type === 'select' && typeof value === 'string') {
    return config.options?.find((o) => o.value === value)?.label ?? value;
  }
  if (config.type === 'number_range') {
    const min = values[config.key];
    const max = config.rangeEndKey ? values[config.rangeEndKey] : undefined;
    const parts: string[] = [];
    if (isActiveFilterValue(min)) {
      parts.push(`≥ ${String(min)}`);
    }
    if (isActiveFilterValue(max)) {
      parts.push(`≤ ${String(max)}`);
    }
    return parts.join(' · ');
  }
  if (config.type === 'date_range') {
    const from = values[config.key];
    const to = config.rangeEndKey ? values[config.rangeEndKey] : undefined;
    const parts: string[] = [];
    if (typeof from === 'string' && from) {
      parts.push(format(new Date(from), 'd MMM', { locale: tr }));
    }
    if (typeof to === 'string' && to) {
      parts.push(format(new Date(to), 'd MMM', { locale: tr }));
    }
    return parts.join(' – ');
  }
  return String(value);
}

function countActiveFilters(
  configs: FilterConfig[],
  values: Record<string, unknown>,
): number {
  let count = 0;
  for (const config of configs) {
    if (config.type === 'number_range' || config.type === 'date_range') {
      const hasStart = isActiveFilterValue(values[config.key]);
      const hasEnd = config.rangeEndKey
        ? isActiveFilterValue(values[config.rangeEndKey])
        : false;
      if (hasStart || hasEnd) {
        count += 1;
      }
      continue;
    }
    if (isActiveFilterValue(values[config.key])) {
      count += 1;
    }
  }
  return count;
}

export function AdvancedFilters({
  filters,
  values,
  onChange,
  onReset,
}: AdvancedFiltersProps): ReactElement {
  const [panelOpen, setPanelOpen] = useState(false);
  const [dateOpenKey, setDateOpenKey] = useState<string | null>(null);

  const activeCount = useMemo(
    () => countActiveFilters(filters, values),
    [filters, values],
  );

  const activeBadges = useMemo(() => {
    const badges: { key: string; label: string; display: string }[] = [];
    for (const config of filters) {
      if (config.type === 'number_range' || config.type === 'date_range') {
        const hasStart = isActiveFilterValue(values[config.key]);
        const hasEnd = config.rangeEndKey
          ? isActiveFilterValue(values[config.rangeEndKey])
          : false;
        if (hasStart || hasEnd) {
          badges.push({
            key: config.key,
            label: config.label,
            display: formatBadgeValue(config, values[config.key], values),
          });
        }
        continue;
      }
      const val = values[config.key];
      if (isActiveFilterValue(val)) {
        badges.push({
          key: config.key,
          label: config.label,
          display: formatBadgeValue(config, val, values),
        });
      }
    }
    return badges;
  }, [filters, values]);

  const setField = (key: string, value: unknown): void => {
    onChange({ ...values, [key]: value });
  };

  const clearFilter = (config: FilterConfig): void => {
    const next = { ...values };
    next[config.key] = undefined;
    if (config.rangeEndKey) {
      next[config.rangeEndKey] = undefined;
    }
    onChange(next);
  };

  const toggleMulti = (config: FilterConfig, optionValue: string, checked: boolean): void => {
    const current = Array.isArray(values[config.key])
      ? [...(values[config.key] as string[])]
      : [];
    if (checked) {
      if (!current.includes(optionValue)) {
        current.push(optionValue);
      }
    } else {
      const idx = current.indexOf(optionValue);
      if (idx >= 0) {
        current.splice(idx, 1);
      }
    }
    setField(config.key, current.length > 0 ? current : undefined);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={panelOpen} onOpenChange={setPanelOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2">
                <Filter className="size-4" aria-hidden />
                Filtreler
                {activeCount > 0 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {activeCount}
                  </Badge>
                ) : null}
                <ChevronDown className="size-4 opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(100vw-2rem,28rem)] p-4" align="start">
              <div className="grid max-h-[min(70vh,32rem)] gap-4 overflow-y-auto pr-1">
                {filters.map((config) => (
                  <div key={config.key} className="grid gap-2">
                    <Label>{config.label}</Label>
                    {config.type === 'text' ? (
                      <Input
                        placeholder={config.placeholder ?? 'Ara…'}
                        value={String(values[config.key] ?? '')}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setField(config.key, v || undefined);
                        }}
                      />
                    ) : null}
                    {config.type === 'select' ? (
                      <Select
                        value={String(values[config.key] ?? 'all')}
                        onValueChange={(v) => {
                          setField(config.key, v === 'all' ? undefined : v);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tümü" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tümü</SelectItem>
                          {(config.options ?? []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {config.type === 'multi_select' ? (
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                        {(config.options ?? []).map((opt) => {
                          const selected = Array.isArray(values[config.key])
                            ? (values[config.key] as string[]).includes(opt.value)
                            : false;
                          return (
                            <label
                              key={opt.value}
                              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted"
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(v) => {
                                  toggleMulti(config, opt.value, v === true);
                                }}
                              />
                              <span className="text-sm">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                    {config.type === 'number_range' ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          placeholder="Min"
                          value={
                            values[config.key] !== undefined
                              ? String(values[config.key])
                              : ''
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setField(
                              config.key,
                              v === '' ? undefined : Number(v.replace(',', '.')),
                            );
                          }}
                        />
                        {config.rangeEndKey ? (
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            placeholder="Max"
                            value={
                              values[config.rangeEndKey] !== undefined
                                ? String(values[config.rangeEndKey])
                                : ''
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setField(
                                config.rangeEndKey!,
                                v === '' ? undefined : Number(v.replace(',', '.')),
                              );
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                    {config.type === 'date_range' ? (
                      <div className="flex flex-wrap gap-2">
                        <Popover
                          open={dateOpenKey === `${config.key}-start`}
                          onOpenChange={(open) => {
                            setDateOpenKey(open ? `${config.key}-start` : null);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="justify-start font-normal"
                            >
                              <CalendarIcon className="mr-2 size-4" aria-hidden />
                              {typeof values[config.key] === 'string' && values[config.key]
                                ? format(new Date(String(values[config.key])), 'd MMM yyyy', {
                                    locale: tr,
                                  })
                                : 'Başlangıç'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                typeof values[config.key] === 'string' && values[config.key]
                                  ? new Date(String(values[config.key]))
                                  : undefined
                              }
                              onSelect={(d) => {
                                setField(
                                  config.key,
                                  d ? format(d, 'yyyy-MM-dd') : undefined,
                                );
                                setDateOpenKey(null);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        {config.rangeEndKey ? (
                          <Popover
                            open={dateOpenKey === `${config.key}-end`}
                            onOpenChange={(open) => {
                              setDateOpenKey(open ? `${config.key}-end` : null);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="justify-start font-normal"
                              >
                                <CalendarIcon className="mr-2 size-4" aria-hidden />
                                {typeof values[config.rangeEndKey] === 'string' &&
                                values[config.rangeEndKey]
                                  ? format(
                                      new Date(String(values[config.rangeEndKey])),
                                      'd MMM yyyy',
                                      { locale: tr },
                                    )
                                  : 'Bitiş'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={
                                  typeof values[config.rangeEndKey!] === 'string' &&
                                  values[config.rangeEndKey!]
                                    ? new Date(String(values[config.rangeEndKey!]))
                                    : undefined
                                }
                                onSelect={(d) => {
                                  setField(
                                    config.rangeEndKey!,
                                    d ? format(d, 'yyyy-MM-dd') : undefined,
                                  );
                                  setDateOpenKey(null);
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end border-t pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPanelOpen(false);
                  }}
                >
                  Kapat
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          {activeCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              Tümünü Temizle
            </Button>
          ) : null}
        </div>
      </div>

      {activeBadges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeBadges.map((badge) => {
            const config = filters.find((f) => f.key === badge.key);
            return (
              <Badge
                key={badge.key}
                variant="secondary"
                className="gap-1 pr-1 font-normal"
              >
                <span className="font-medium">{badge.label}:</span>
                <span>{badge.display}</span>
                <button
                  type="button"
                  className="hover:bg-muted-foreground/20 ml-0.5 rounded-sm p-0.5"
                  aria-label={`${badge.label} filtresini kaldır`}
                  onClick={() => {
                    if (config) {
                      clearFilter(config);
                    }
                  }}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
