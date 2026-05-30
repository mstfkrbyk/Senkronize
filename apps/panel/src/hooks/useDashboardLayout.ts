import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getAllowedWidgetTypes,
  getDefaultLayoutForOrg,
  mergeLayoutOrder,
} from '@/lib/dashboard-widget-registry';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useAuthStore } from '@/store/auth.store';
import type { AccountingMode, OrgProductLine } from '@/types/auth';
import type { WidgetType } from '@/types/dashboard-widgets';

export const DASHBOARD_LAYOUT_STORAGE_KEY = 'senkronize-dashboard-layout';

function readStoredLayout(
  orgProducts: OrgProductLine[] | undefined,
  accountingMode: AccountingMode,
): WidgetType[] {
  const defaults = getDefaultLayoutForOrg(orgProducts, accountingMode);
  const allowed = new Set(getAllowedWidgetTypes(orgProducts, accountingMode));
  try {
    const raw = localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return defaults;
    }
    const valid = parsed.filter(
      (item): item is WidgetType => typeof item === 'string' && allowed.has(item as WidgetType),
    );
    return mergeLayoutOrder(valid, defaults, orgProducts, accountingMode);
  } catch {
    return defaults;
  }
}

export function useDashboardLayout(): {
  layout: WidgetType[];
  setLayout: (next: WidgetType[]) => void;
  resetLayout: () => void;
} {
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const defaults = useMemo(
    () => getDefaultLayoutForOrg(orgProducts, accountingMode),
    [orgProducts, accountingMode],
  );

  const [layout, setLayoutState] = useState<WidgetType[]>(() =>
    readStoredLayout(orgProducts, 'NATIVE'),
  );

  useEffect(() => {
    setLayoutState(readStoredLayout(orgProducts, accountingMode));
  }, [orgProducts, accountingMode]);

  const setLayout = useCallback(
    (next: WidgetType[]): void => {
      const merged = mergeLayoutOrder(next, defaults, orgProducts, accountingMode);
      setLayoutState(merged);
      localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(merged));
    },
    [defaults, orgProducts, accountingMode],
  );

  const resetLayout = useCallback((): void => {
    setLayout(defaults);
  }, [defaults, setLayout]);

  return { layout, setLayout, resetLayout };
}
