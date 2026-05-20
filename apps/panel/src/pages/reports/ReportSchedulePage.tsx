import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { SavedReportListItem } from '@/types/custom-report';

import { useSavedReportsList } from './hooks/useCustomReports';
import { useReportSchedules } from './hooks/useReportSchedules';
import { ReportScheduleModal } from './ReportScheduleModal';

type EventKind = 'SALES' | 'STOCK' | 'PROFIT' | 'CUSTOM';

interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  kind: EventKind;
  detail: string;
}

const KIND_STYLES: Record<EventKind, string> = {
  SALES: 'bg-sky-500 text-white',
  STOCK: 'bg-emerald-600 text-white',
  PROFIT: 'bg-orange-500 text-white',
  CUSTOM: 'bg-violet-600 text-white',
};

const KIND_LABELS: Record<EventKind, string> = {
  SALES: 'Satış',
  STOCK: 'Stok',
  PROFIT: 'Kâr',
  CUSTOM: 'Özel',
};

function kindFromReportKind(k: string): EventKind {
  if (k === 'STOCK') return 'STOCK';
  if (k === 'PROFIT') return 'PROFIT';
  if (k === 'SALES') return 'SALES';
  return 'CUSTOM';
}

function eventsForMonth(
  month: Date,
  standard: Array<{ id: string; reportKind: string; frequency: string; emails: string[] }>,
  saved: SavedReportListItem[],
): CalendarEvent[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const events: CalendarEvent[] = [];

  for (const day of days) {
    const dow = getDay(day);
    const dom = day.getDate();

    for (const s of standard) {
      if (s.emails.length === 0) continue;
      const should =
        s.frequency === 'WEEKLY' ? dow === 1 : dom === 1;
      if (!should) continue;
      events.push({
        id: `std-${s.id}-${format(day, 'yyyy-MM-dd')}`,
        date: day,
        title: `${KIND_LABELS[kindFromReportKind(s.reportKind)]} raporu`,
        kind: kindFromReportKind(s.reportKind),
        detail: `${s.emails.length} alıcı · ${s.frequency === 'WEEKLY' ? 'Haftalık' : 'Aylık'}`,
      });
    }

    for (const r of saved) {
      const sch = r.schedule;
      if (!sch || sch.emails.length === 0) continue;
      const freq = sch.frequency === 'weekly' ? 'weekly' : 'daily';
      const should = freq === 'weekly' ? dow === 1 : true;
      if (!should) continue;
      events.push({
        id: `custom-${r.id}-${format(day, 'yyyy-MM-dd')}`,
        date: day,
        title: r.name,
        kind: 'CUSTOM',
        detail: `${sch.emails.length} alıcı · ${freq === 'weekly' ? 'Haftalık' : 'Günlük'}`,
      });
    }
  }

  return events;
}

export function ReportSchedulePage(): ReactElement {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const schedulesQuery = useReportSchedules();
  const savedQuery = useSavedReportsList();

  const events = useMemo(() => {
    const std = (schedulesQuery.data ?? []).map((s) => ({
      id: s.id,
      reportKind: s.reportKind,
      frequency: s.frequency,
      emails: s.emails,
    }));
    return eventsForMonth(cursor, std, savedQuery.data ?? []);
  }, [cursor, schedulesQuery.data, savedQuery.data]);

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const cells = eachDayOfInterval({
    start: gridStart,
    end: startOfWeek(addDays(endOfMonth(cursor), 7), { weekStartsOn: 1 }),
  }).slice(0, 42);

  const isLoading = schedulesQuery.isLoading || savedQuery.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Planlanmış rapor gönderimleri takvimde gösterilir.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
          <CalendarClock className="mr-2 h-4 w-4" />
          Yeni zamanlama
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className={cn('h-3 w-3 rounded', KIND_STYLES.SALES)} /> Satış
        </span>
        <span className="flex items-center gap-1">
          <span className={cn('h-3 w-3 rounded', KIND_STYLES.STOCK)} /> Stok
        </span>
        <span className="flex items-center gap-1">
          <span className={cn('h-3 w-3 rounded', KIND_STYLES.PROFIT)} /> Kâr
        </span>
        <span className="flex items-center gap-1">
          <span className={cn('h-3 w-3 rounded', KIND_STYLES.CUSTOM)} /> Özel
        </span>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {format(cursor, 'MMMM yyyy', { locale: tr })}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setCursor((d) => addDays(startOfMonth(d), -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setCursor((d) => addDays(endOfMonth(d), 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <>
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day) => {
                  const dayEvents = events.filter((e) => isSameDay(e.date, day));
                  const inMonth = isSameMonth(day, cursor);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'min-h-[88px] rounded-md border p-1 text-xs',
                        inMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground',
                      )}
                    >
                      <div className="mb-1 font-medium">{format(day, 'd')}</div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            className={cn('truncate rounded px-1 py-0.5', KIND_STYLES[ev.kind])}
                            title={`${ev.title} — ${ev.detail}`}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 ? (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayEvents.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yaklaşan gönderimler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu ay için planlı rapor yok.</p>
          ) : (
            events
              .filter((e) => e.date >= new Date())
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .slice(0, 8)
              .map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <span className={cn('mr-2 inline-block h-2 w-2 rounded-full', KIND_STYLES[ev.kind])} />
                    <span className="font-medium">{ev.title}</span>
                    <span className="ml-2 text-muted-foreground">{ev.detail}</span>
                  </div>
                  <span className="tabular-nums text-muted-foreground">
                    {format(ev.date, 'dd MMM yyyy', { locale: tr })}
                  </span>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      <ReportScheduleModal open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </div>
  );
}
