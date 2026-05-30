import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  filterWidgets,
  getDefaultWidgetsForOrg,
} from '@/lib/dashboard-widget-registry';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { api } from '@/lib/api';
import { WIDGET_DEFAULT_SIZE } from '@/pages/dashboard/widget-meta';
import { useAuthStore } from '@/store/auth.store';
import { parseStoredWidgets, type Widget, type WidgetType } from '@/types/dashboard-widgets';

function sortByPosition(widgets: Widget[]): Widget[] {
  return [...widgets].sort((a, b) => a.position - b.position);
}

interface WidgetsApiResponse {
  widgets: Widget[];
}

export function useDashboardWidgets(): {
  widgets: Widget[];
  enabledTypes: Set<WidgetType>;
  isLoading: boolean;
  isSaving: boolean;
  saveWidgets: (
    draft: Widget[],
    options?: { onSuccess?: () => void; onError?: () => void },
  ) => void;
  resetToDefault: () => Widget[];
  isVisible: (type: WidgetType) => boolean;
} {
  const queryClient = useQueryClient();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();

  const query = useQuery({
    queryKey: ['dashboard', 'widgets'],
    queryFn: async (): Promise<Widget[]> => {
      const { data } = await api.get<WidgetsApiResponse>('/dashboard/widgets');
      return sortByPosition(parseStoredWidgets(data.widgets));
    },
    staleTime: 300_000,
  });

  const mutation = useMutation({
    mutationFn: async (draft: Widget[]): Promise<Widget[]> => {
      const scoped = filterWidgets(draft, orgProducts, accountingMode);
      const normalized = sortByPosition(
        scoped.map((w, index) => ({
          ...w,
          position: index,
          visible: w.visible !== false,
          size: w.size ?? WIDGET_DEFAULT_SIZE[w.type],
        })),
      );
      const { data } = await api.patch<WidgetsApiResponse>('/dashboard/widgets', {
        widgets: normalized,
      });
      return sortByPosition(parseStoredWidgets(data.widgets));
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['dashboard', 'widgets'], saved);
    },
  });

  const widgets = useMemo(
    () =>
      filterWidgets(
        query.data ?? getDefaultWidgetsForOrg(orgProducts),
        orgProducts,
        accountingMode,
      ),
    [query.data, orgProducts, accountingMode],
  );

  const enabledTypes = useMemo(
    () =>
      new Set(
        widgets.filter((w) => w.visible !== false).map((w) => w.type),
      ),
    [widgets],
  );

  const isVisible = useCallback(
    (type: WidgetType): boolean => enabledTypes.has(type),
    [enabledTypes],
  );

  const saveWidgets = useCallback(
    (
      draft: Widget[],
      options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
    ): void => {
      mutation.mutate(draft, {
        onSuccess: () => {
          options?.onSuccess?.();
        },
        onError: (error: unknown) => {
          options?.onError?.(error);
        },
      });
    },
    [mutation],
  );

  const resetToDefault = useCallback((): Widget[] => {
    return sortByPosition(getDefaultWidgetsForOrg(orgProducts));
  }, [orgProducts]);

  return {
    widgets,
    enabledTypes,
    isLoading: query.isPending,
    isSaving: mutation.isPending,
    saveWidgets,
    resetToDefault,
    isVisible,
  };
}
