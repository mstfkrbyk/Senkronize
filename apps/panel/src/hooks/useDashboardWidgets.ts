import { useCallback, useMemo, useState } from 'react';

import {
  DEFAULT_WIDGETS,
  WIDGET_STORAGE_KEY,
  type Widget,
  type WidgetType,
} from '@/types/dashboard-widgets';

function loadWidgets(): Widget[] {
  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WIDGETS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_WIDGETS;
    }
    return parsed as Widget[];
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
  toggleWidget: (type: WidgetType, enabled: boolean) => void;
  saveWidgets: (draft: Widget[]) => void;
  resetToDefault: () => void;
} {
  const [widgets, setWidgets] = useState<Widget[]>(() => sortByPosition(loadWidgets()));

  const enabledTypes = useMemo(
    () => new Set(widgets.map((w) => w.type)),
    [widgets],
  );

  const persist = useCallback((next: Widget[]): void => {
    const sorted = sortByPosition(next);
    setWidgets(sorted);
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(sorted));
  }, []);

  const toggleWidget = useCallback(
    (type: WidgetType, enabled: boolean): void => {
      setWidgets((prev) => {
        const has = prev.some((w) => w.type === type);
        if (enabled && has) {
          return prev;
        }
        if (!enabled && !has) {
          return prev;
        }
        if (!enabled) {
          const next = prev.filter((w) => w.type !== type);
          localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(sortByPosition(next)));
          return next;
        }
        const meta = DEFAULT_WIDGETS.find((w) => w.type === type);
        const maxPos = prev.reduce((m, w) => Math.max(m, w.position), -1);
        const next: Widget[] = [
          ...prev,
          {
            id: meta?.id ?? `w-${type}`,
            type,
            size: meta?.size ?? '1x1',
            position: maxPos + 1,
          },
        ];
        localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(sortByPosition(next)));
        return next;
      });
    },
    [],
  );

  const saveWidgets = useCallback(
    (draft: Widget[]): void => {
      persist(draft);
    },
    [persist],
  );

  const resetToDefault = useCallback((): void => {
    persist(DEFAULT_WIDGETS);
  }, [persist]);

  return {
    widgets: sortByPosition(widgets),
    enabledTypes,
    toggleWidget,
    saveWidgets,
    resetToDefault,
  };
}
