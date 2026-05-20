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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Widget, WidgetType } from '@/types/dashboard-widgets';

import { widgetGridClass } from './widget-meta';

interface SortableWidgetShellProps {
  id: string;
  editMode: boolean;
  gridClass: string;
  onRemove: () => void;
  children: ReactNode;
}

function SortableWidgetShell({
  id,
  editMode,
  gridClass,
  onRemove,
  children,
}: SortableWidgetShellProps): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        gridClass,
        'relative',
        editMode && 'ring-2 ring-dashed ring-accent/40 rounded-lg',
        isDragging && 'z-10 opacity-90',
      )}
    >
      {editMode ? (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border bg-background shadow-sm active:cursor-grabbing"
            aria-label="Sürükleyerek taşı"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden />
          </button>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-7 w-7"
            aria-label="Widget kaldır"
            onClick={onRemove}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : null}
      {children}
    </div>
  );
}

interface Props {
  widgets: Widget[];
  editMode: boolean;
  onReorder: (widgets: Widget[]) => void;
  onRemove: (type: WidgetType) => void;
  renderWidget: (type: WidgetType) => ReactElement | null;
}

export function DashboardWidgetGrid({
  widgets,
  editMode,
  onReorder,
  onRemove,
  renderWidget,
}: Props): ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    onReorder(arrayMove(widgets, oldIndex, newIndex).map((w, index) => ({ ...w, position: index })));
  };

  const content = widgets.map((widget) => {
    const body = renderWidget(widget.type);
    if (!body) {
      return null;
    }
    return (
      <SortableWidgetShell
        key={widget.id}
        id={widget.id}
        editMode={editMode}
        gridClass={widgetGridClass(widget.size)}
        onRemove={() => {
          onRemove(widget.type);
        }}
      >
        {body}
      </SortableWidgetShell>
    );
  });

  if (!editMode) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 auto-rows-min">{content}</div>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 auto-rows-min">{content}</div>
      </SortableContext>
    </DndContext>
  );
}
