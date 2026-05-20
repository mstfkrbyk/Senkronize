import { CalendarIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  useDashboardPeriod,
  type DashboardPeriodPreset,
} from '@/hooks/useDashboardPeriod';

export function DashboardPeriodSelector(): ReactElement {
  const { t } = useTranslation();
  const { state, setPreset, setCustomRange } = useDashboardPeriod();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const PRESETS: { id: DashboardPeriodPreset; label: string }[] = [
    { id: 'today', label: t('dashboard.periodToday') },
    { id: '7d', label: t('dashboard.period7d') },
    { id: '30d', label: t('dashboard.period30d') },
    { id: 'month', label: t('dashboard.periodMonth') },
  ];

  const range: DateRange | undefined =
    state.customFrom && state.customTo
      ? { from: state.customFrom, to: state.customTo }
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex rounded-lg border bg-muted/40 p-0.5"
        role="group"
        aria-label={t('dashboard.periodSelectorLabel')}
      >
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={state.preset === p.id ? 'default' : 'ghost'}
            className={cn(
              'h-8 rounded-md px-3',
              state.preset === p.id && 'shadow-sm',
            )}
            onClick={() => {
              setPreset(p.id);
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {state.preset === 'custom' ? (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-2">
              <CalendarIcon className="h-4 w-4" aria-hidden />
              {range?.from && range.to
                ? `${format(range.from, 'd MMM', { locale: tr })} – ${format(range.to, 'd MMM yyyy', { locale: tr })}`
                : t('dashboard.selectDateRange')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(selected) => {
                if (selected?.from && selected.to) {
                  setCustomRange(selected.from, selected.to);
                  setCalendarOpen(false);
                } else if (selected?.from) {
                  setCustomRange(selected.from, null);
                }
              }}
              numberOfMonths={2}
              defaultMonth={range?.from}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
