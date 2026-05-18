import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { usePricingRules, useScheduleRule } from './hooks/usePricing';

const DAY_LABELS: Array<{ dow: number; label: string }> = [
  { dow: 0, label: 'Paz' },
  { dow: 1, label: 'Pzt' },
  { dow: 2, label: 'Sal' },
  { dow: 3, label: 'Çar' },
  { dow: 4, label: 'Per' },
  { dow: 5, label: 'Cum' },
  { dow: 6, label: 'Cmt' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleRuleDialog({ open, onOpenChange }: Props): ReactElement {
  const rulesQuery = usePricingRules(open);
  const scheduleMutation = useScheduleRule();
  const [ruleId, setRuleId] = useState<string>('');
  const [startLocal, setStartLocal] = useState<string>('');
  const [endLocal, setEndLocal] = useState<string>('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hoursStart, setHoursStart] = useState<string>('9');
  const [hoursEnd, setHoursEnd] = useState<string>('18');

  useEffect(() => {
    if (!open) {
      setRuleId('');
      setStartLocal('');
      setEndLocal('');
      setDays([1, 2, 3, 4, 5]);
      setHoursStart('9');
      setHoursEnd('18');
    }
  }, [open]);

  const toggleDay = (dow: number): void => {
    setDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b),
    );
  };

  const onSubmit = (): void => {
    if (!ruleId) {
      return;
    }
    const scheduledStart =
      startLocal.trim() === '' ? null : new Date(startLocal).toISOString();
    const scheduledEnd =
      endLocal.trim() === '' ? null : new Date(endLocal).toISOString();
    const hs = Number.parseInt(hoursStart, 10);
    const he = Number.parseInt(hoursEnd, 10);
    scheduleMutation.mutate(
      {
        id: ruleId,
        scheduledStart,
        scheduledEnd,
        daysOfWeek: days.length > 0 ? days : [],
        hoursStart: Number.isFinite(hs) ? hs : null,
        hoursEnd: Number.isFinite(he) ? he : null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Zamanlama ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kural</Label>
            <Select
              value={ruleId === '' ? undefined : ruleId}
              onValueChange={(v) => {
                setRuleId(v);
              }}
            >
              <SelectTrigger aria-label="Kural seç">
                <SelectValue placeholder="Kural seçin" />
              </SelectTrigger>
              <SelectContent>
                {(rulesQuery.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} — {r.platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sched-start">Başlangıç (yerel)</Label>
              <Input
                id="sched-start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => {
                  setStartLocal(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-end">Bitiş (yerel)</Label>
              <Input
                id="sched-end"
                type="datetime-local"
                value={endLocal}
                onChange={(e) => {
                  setEndLocal(e.target.value);
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Günler (0=Pazar)</Label>
            <div className="flex flex-wrap gap-3">
              {DAY_LABELS.map(({ dow, label }) => (
                <label key={dow} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={days.includes(dow)}
                    onCheckedChange={() => {
                      toggleDay(dow);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="h-start">Başlangıç saati (İstanbul 0–23)</Label>
              <Input
                id="h-start"
                type="number"
                min={0}
                max={23}
                value={hoursStart}
                onChange={(e) => {
                  setHoursStart(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-end">Bitiş saati (İstanbul 0–23)</Label>
              <Input
                id="h-end"
                type="number"
                min={0}
                max={23}
                value={hoursEnd}
                onChange={(e) => {
                  setHoursEnd(e.target.value);
                }}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            type="button"
            disabled={!ruleId || scheduleMutation.isPending}
            onClick={() => {
              onSubmit();
            }}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
