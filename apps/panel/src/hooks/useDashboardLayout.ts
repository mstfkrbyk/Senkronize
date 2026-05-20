import { useCallback, useState } from 'react';

import type { WidgetType } from '@/types/dashboard-widgets';

export const DASHBOARD_LAYOUT_STORAGE_KEY = 'senkronize-dashboard-layout';

export const DEFAULT_DASHBOARD_LAYOUT: WidgetType[] = [
  'chart-sales',
  'table-orders',
  'chart-platforms',
  'table-stock',
];

function readStoredLayout(): WidgetType[] {
  try {
    const raw = localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
    const valid = parsed.filter(
      (item): item is WidgetType =>
        typeof item === 'string' &&
        ['chart-sales', 'table-orders', 'chart-platforms', 'table-stock'].includes(item),
    );
    return valid.length > 0 ? valid : DEFAULT_DASHBOARD_LAYOUT;
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT;
  }
}

export function useDashboardLayout(): {
  layout: WidgetType[];
  setLayout: (next: WidgetType[]) => void;
  resetLayout: () => void;
} {
  const [layout, setLayoutState] = useState<WidgetType[]>(readStoredLayout);

  const setLayout = useCallback((next: WidgetType[]): void => {
    setLayoutState(next);
    localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const resetLayout = useCallback((): void => {
    setLayout(DEFAULT_DASHBOARD_LAYOUT);
  }, [setLayout]);

  return { layout, setLayout, resetLayout };
}
