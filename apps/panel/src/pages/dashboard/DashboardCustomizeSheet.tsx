import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import type { Widget, WidgetType } from '@/types/dashboard-widgets';

import { ALL_WIDGET_TYPES, WIDGET_LABELS } from './widget-meta';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledTypes: Set<WidgetType>;
  widgets: Widget[];
  onSave: (widgets: Widget[]) => void;
}

export function DashboardCustomizeSheet({
  open,
  onOpenChange,
  enabledTypes,
  widgets,
  onSave,
}: Props): ReactElement {
  const [draft, setDraft] = useState<Set<WidgetType>>(enabledTypes);

  useEffect(() => {
    if (open) {
      setDraft(new Set(enabledTypes));
    }
  }, [open, enabledTypes]);

  const toggle = (type: WidgetType, checked: boolean): void => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(type);
      } else {
        next.delete(type);
      }
      return next;
    });
  };

  const handleSave = (): void => {
    const kept = widgets.filter((w) => draft.has(w.type));
    const missing = ALL_WIDGET_TYPES.filter(
      (t) => draft.has(t) && !kept.some((w) => w.type === t),
    );
    let pos = kept.reduce((m, w) => Math.max(m, w.position), -1);
    const added: Widget[] = missing.map((type) => {
      pos += 1;
      const existing = widgets.find((w) => w.type === type);
      return (
        existing ?? {
          id: `w-${type}`,
          type,
          size:
            type.startsWith('chart_') || type === 'table_recent_orders'
              ? '2x1'
              : '1x1',
          position: pos,
        }
      );
    });
    onSave([...kept, ...added].sort((a, b) => a.position - b.position));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Dashboard düzenle</SheetTitle>
          <SheetDescription>
            Göstermek istediğiniz widget&apos;ları açıp kapatın.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {ALL_WIDGET_TYPES.map((type) => (
            <div
              key={type}
              className="flex items-center justify-between gap-4 rounded-lg border p-3"
            >
              <Label htmlFor={`widget-${type}`} className="cursor-pointer">
                {WIDGET_LABELS[type]}
              </Label>
              <Switch
                id={`widget-${type}`}
                checked={draft.has(type)}
                onCheckedChange={(checked) => {
                  toggle(type, checked);
                }}
              />
            </div>
          ))}
        </div>
        <SheetFooter className="gap-2 sm:flex-col">
          <Button type="button" className="w-full" onClick={handleSave}>
            Kaydet
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            İptal
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
