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
import { GripVertical } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { WidgetType } from '@/types/dashboard-widgets';

interface SortableGridItemProps {
  id: WidgetType;
  className?: string;
  children: ReactNode;
}

function SortableGridItem({
  id,
  className,
  children,
}: SortableGridItemProps): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative', className, isDragging && 'z-10 opacity-90')}
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-20 flex h-7 w-7 cursor-grab items-center justify-center rounded-md border bg-background/90 shadow-sm backdrop-blur active:cursor-grabbing"
        aria-label="Widget sırasını değiştir"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden />
      </button>
      {children}
    </div>
  );
}

interface Props {
  layout: WidgetType[];
  onReorder: (layout: WidgetType[]) => void;
  renderWidget: (type: WidgetType) => ReactElement | null;
  gridClassName?: string;
  getItemClassName?: (type: WidgetType) => string;
}

export function DashboardGrid({
  layout,
  onReorder,
  renderWidget,
  gridClassName = 'grid grid-cols-1 gap-4 lg:grid-cols-2',
  getItemClassName,
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
    const oldIndex = layout.indexOf(active.id as WidgetType);
    const newIndex = layout.indexOf(over.id as WidgetType);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    onReorder(arrayMove(layout, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={layout} strategy={rectSortingStrategy}>
        <div className={gridClassName}>
          {layout.map((type) => {
            const body = renderWidget(type);
            if (!body) {
              return null;
            }
            return (
              <SortableGridItem
                key={type}
                id={type}
                className={getItemClassName?.(type)}
              >
                {body}
              </SortableGridItem>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
