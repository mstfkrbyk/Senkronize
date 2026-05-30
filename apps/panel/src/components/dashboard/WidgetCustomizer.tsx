import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, LayoutGrid, RotateCcw, Save } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { getApiErrorMessage } from '@/lib/api';
import { getWidgetCustomizerHint } from '@/lib/dashboard-widget-registry';
import { WIDGET_LABELS } from '@/pages/dashboard/widget-meta';
import { useAuthStore } from '@/store/auth.store';
import type { Widget } from '@/types/dashboard-widgets';

interface SortableWidgetRowProps {
  widget: Widget;
  hint?: string;
  onToggleVisible: (id: string, visible: boolean) => void;
}

function SortableWidgetRow({
  widget,
  hint,
  onToggleVisible,
}: SortableWidgetRowProps): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const label = WIDGET_LABELS[widget.type] ?? widget.type;
  const visible = widget.visible !== false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 ${
        isDragging ? 'z-10 opacity-90 shadow-md' : ''
      }`}
    >
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md border bg-background active:cursor-grabbing"
        aria-label={`${label} sırasını değiştir`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {hint ?? (visible ? 'Görünür' : 'Gizli')}
        </p>
      </div>
      <Switch
        checked={visible}
        onCheckedChange={(checked) => {
          onToggleVisible(widget.id, checked);
        }}
        aria-label={`${label} görünürlüğü`}
      />
    </div>
  );
}

export function WidgetCustomizer(): ReactElement {
  const [open, setOpen] = useState(false);
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const { widgets, saveWidgets, resetToDefault, isSaving } = useDashboardWidgets();
  const [draft, setDraft] = useState<Widget[]>(widgets);

  useEffect(() => {
    if (open) {
      setDraft(widgets);
    }
  }, [open, widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = draft.findIndex((w) => w.id === active.id);
    const newIndex = draft.findIndex((w) => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    setDraft(
      arrayMove(draft, oldIndex, newIndex).map((w, index) => ({
        ...w,
        position: index,
      })),
    );
  };

  const handleToggleVisible = (id: string, visible: boolean): void => {
    setDraft((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible } : w)),
    );
  };

  const handleSave = (): void => {
    saveWidgets(draft, {
      onSuccess: () => {
        toast.success('Dashboard düzeni kaydedildi.');
        setOpen(false);
      },
      onError: (error: unknown) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  const handleReset = (): void => {
    const defaults = resetToDefault();
    setDraft(defaults);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <LayoutGrid className="mr-1.5 h-4 w-4" aria-hidden />
          Dashboard&apos;u Özelleştir
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Dashboard özelleştirme</SheetTitle>
          <SheetDescription>
            Widget görünürlüğünü ayarlayın ve sıralamayı sürükleyerek değiştirin.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={draft.map((w) => w.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {draft.map((widget) => (
                  <SortableWidgetRow
                    key={widget.id}
                    widget={widget}
                    hint={getWidgetCustomizerHint(
                      widget.type,
                      orgProducts,
                      accountingMode,
                    )}
                    onToggleVisible={handleToggleVisible}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <SheetFooter className="flex-row gap-2 sm:justify-between">
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
            Varsayılan
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={handleSave}
          >
            <Save className="mr-1.5 h-4 w-4" aria-hidden />
            Kaydet
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
