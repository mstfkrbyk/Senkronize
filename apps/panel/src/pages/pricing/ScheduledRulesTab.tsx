import type { ReactElement } from 'react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api';
import type { PricingRule } from '@/types/pricing';

import { ScheduleRuleDialog } from './ScheduleRuleDialog';
import { usePricingRules, useScheduledRules } from './hooks/usePricing';

function scheduleSummary(rule: PricingRule): string {
  const parts: string[] = [];
  if (rule.scheduledStart) {
    parts.push(`Baş: ${new Date(rule.scheduledStart).toLocaleString('tr-TR')}`);
  }
  if (rule.scheduledEnd) {
    parts.push(`Bit: ${new Date(rule.scheduledEnd).toLocaleString('tr-TR')}`);
  }
  if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    parts.push(`Günler: ${rule.daysOfWeek.join(',')}`);
  }
  if (rule.hoursStart != null && rule.hoursEnd != null) {
    parts.push(`Saat: ${rule.hoursStart}–${rule.hoursEnd} (İstanbul)`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function badgeForRule(rule: PricingRule): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  if (!rule.isActive) {
    return { label: 'Pasif', variant: 'secondary' };
  }
  if (rule.scheduledStart) {
    const t = new Date(rule.scheduledStart).getTime();
    if (t > Date.now()) {
      return { label: 'Yaklaşan', variant: 'outline' };
    }
  }
  return { label: 'Aktif', variant: 'default' };
}

interface Props {
  proAccess: boolean;
}

export function ScheduledRulesTab({ proAccess }: Props): ReactElement {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const scheduledQuery = useScheduledRules(proAccess);
  const rulesQuery = usePricingRules(proAccess);

  const scheduledConfigured = (rulesQuery.data ?? []).filter(
    (r) =>
      (r.scheduledStart != null && r.scheduledStart !== '') ||
      (r.scheduledEnd != null && r.scheduledEnd !== '') ||
      (r.daysOfWeek && r.daysOfWeek.length > 0) ||
      r.hoursStart != null ||
      r.hoursEnd != null,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-primary">Zamanlanmış kurallar</h2>
          <p className="text-sm text-muted-foreground">
            Tarih, haftanın günleri ve İstanbul saatine göre uygulanan kurallar. Şu an pencere
            dışında kalanlar aşağıda listelenir.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setScheduleOpen(true)}>
          Zamanlama ekle
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Şu an zaman penceresi dışında</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduledQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {scheduledQuery.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(scheduledQuery.error)}</p>
          ) : null}
          {!scheduledQuery.isLoading &&
          !scheduledQuery.isError &&
          (scheduledQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zamanlama tanımlı ve şu an uygulanmayan kural yok.
            </p>
          ) : null}
          {!scheduledQuery.isLoading && !scheduledQuery.isError && scheduledQuery.data?.length ? (
            <ul className="space-y-3">
              {scheduledQuery.data.map((r) => {
                const b = badgeForRule(r);
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-1 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{scheduleSummary(r)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={b.variant}>{b.label}</Badge>
                      <span className="text-xs text-muted-foreground">{r.platform}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Zamanlama tanımlı tüm kurallar</CardTitle>
        </CardHeader>
        <CardContent>
          {rulesQuery.isLoading ? <Skeleton className="h-20 w-full" /> : null}
          {scheduledConfigured.length === 0 && !rulesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Henüz zamanlama alanı doldurulmuş kural yok. &quot;Zamanlama ekle&quot; ile başlayın.
            </p>
          ) : null}
          {scheduledConfigured.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {scheduledConfigured.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 border-b py-2 last:border-0">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">{scheduleSummary(r)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <ScheduleRuleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </div>
  );
}
