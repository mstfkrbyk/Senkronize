import { useCallback, useMemo, useState } from 'react';

import {
  DEFAULT_WIDGETS,
  WIDGET_STORAGE_KEY,
  parseStoredWidgets,
  type Widget,
  type WidgetType,
} from '@/types/dashboard-widgets';

import { WIDGET_DEFAULT_SIZE } from '@/pages/dashboard/widget-meta';

function loadWidgets(): Widget[] {
  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WIDGETS;
    }
    return parseStoredWidgets(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function sortByPosition(widgets: Widget[]): Widget[] {
  return [...widgets].sort((a, b) => a.position - b.position);
}

export function useDashboardWidgets(): {
  widgets: Widget[];
  enabledTypes: Set<WidgetType>;
  saveWidgets: (draft: Widget[]) => void;
  resetToDefault: () => Widget[];
  removeWidget: (widgets: Widget[], type: WidgetType) => Widget[];
  addWidget: (widgets: Widget[], type: WidgetType) => Widget[];
  reorderWidgets: (widgets: Widget[], activeId: string, overId: string) => Widget[];
} {
  const [widgets, setWidgets] = useState<Widget[]>(() => sortByPosition(loadWidgets()));

  const enabledTypes = useMemo(
    () => new Set(widgets.map((w) => w.type)),
    [widgets],
  );

  const persist = useCallback((next: Widget[]): void => {
    const sorted = sortByPosition(
      next.map((w, index) => ({ ...w, position: index })),
    );
    setWidgets(sorted);
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(sorted));
  }, []);

  const saveWidgets = useCallback(
    (draft: Widget[]): void => {
      persist(draft);
    },
    [persist],
  );

  const resetToDefault = useCallback((): Widget[] => {
    return sortByPosition(DEFAULT_WIDGETS);
  }, []);

  const removeWidget = useCallback((list: Widget[], type: WidgetType): Widget[] => {
    return sortByPosition(list.filter((w) => w.type !== type));
  }, []);

  const addWidget = useCallback((list: Widget[], type: WidgetType): Widget[] => {
    if (list.some((w) => w.type === type)) {
      return list;
    }
    const maxPos = list.reduce((m, w) => Math.max(m, w.position), -1);
    return sortByPosition([
      ...list,
      {
        id: `w-${type}-${String(Date.now())}`,
        type,
        size: WIDGET_DEFAULT_SIZE[type],
        position: maxPos + 1,
      },
    ]);
  }, []);

  const reorderWidgets = useCallback(
    (list: Widget[], activeId: string, overId: string): Widget[] => {
      const oldIndex = list.findIndex((w) => w.id === activeId);
      const newIndex = list.findIndex((w) => w.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        return list;
      }
      const next = [...list];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return sortByPosition(next.map((w, index) => ({ ...w, position: index })));
    },
    [],
  );

  return {
    widgets: sortByPosition(widgets),
    enabledTypes,
    saveWidgets,
    resetToDefault,
    removeWidget,
    addWidget,
    reorderWidgets,
  };
}
