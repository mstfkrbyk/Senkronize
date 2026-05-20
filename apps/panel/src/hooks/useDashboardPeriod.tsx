import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

export type DashboardPeriodPreset = 'today' | 'week' | 'month' | 'custom';

export interface DashboardPeriodState {
  preset: DashboardPeriodPreset;
  customFrom: Date | null;
  customTo: Date | null;
}

export interface DashboardPeriodApiParams {
  summaryPeriod: 'default' | '24h' | '7d' | 'month';
  kpiPeriod: '7d' | '30d' | '90d';
  trendDays: number;
  queryKey: string;
}

function daysBetween(from: Date, to: Date): number {
  const ms = Math.abs(to.getTime() - from.getTime());
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

export function resolveDashboardPeriodApi(
  state: DashboardPeriodState,
): DashboardPeriodApiParams {
  if (state.preset === 'today') {
    return {
      summaryPeriod: 'default',
      kpiPeriod: '7d',
      trendDays: 30,
      queryKey: 'today',
    };
  }

  if (state.preset === 'week') {
    return {
      summaryPeriod: '7d',
      kpiPeriod: '7d',
      trendDays: 7,
      queryKey: 'week',
    };
  }

  if (state.preset === 'month') {
    return {
      summaryPeriod: 'month',
      kpiPeriod: '30d',
      trendDays: 30,
      queryKey: 'month',
    };
  }

  const from = state.customFrom ?? new Date();
  const to = state.customTo ?? new Date();
  const days = daysBetween(from, to);
  const summaryPeriod: DashboardPeriodApiParams['summaryPeriod'] =
    days <= 1 ? '24h' : days <= 7 ? '7d' : 'month';
  const kpiPeriod: DashboardPeriodApiParams['kpiPeriod'] =
    days <= 7 ? '7d' : days <= 30 ? '30d' : '90d';

  return {
    summaryPeriod,
    kpiPeriod,
    trendDays: Math.min(days, 90),
    queryKey: `custom:${from.toISOString().slice(0, 10)}:${to.toISOString().slice(0, 10)}`,
  };
}

interface DashboardPeriodContextValue {
  state: DashboardPeriodState;
  api: DashboardPeriodApiParams;
  setPreset: (preset: DashboardPeriodPreset) => void;
  setCustomRange: (from: Date | null, to: Date | null) => void;
}

const DashboardPeriodContext = createContext<DashboardPeriodContextValue | null>(
  null,
);

export function DashboardPeriodProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [state, setState] = useState<DashboardPeriodState>({
    preset: 'today',
    customFrom: null,
    customTo: null,
  });

  const api = useMemo(() => resolveDashboardPeriodApi(state), [state]);

  const setPreset = useCallback((preset: DashboardPeriodPreset): void => {
    setState((prev) => ({ ...prev, preset }));
  }, []);

  const setCustomRange = useCallback((from: Date | null, to: Date | null): void => {
    setState({ preset: 'custom', customFrom: from, customTo: to });
  }, []);

  const value = useMemo(
    () => ({ state, api, setPreset, setCustomRange }),
    [state, api, setPreset, setCustomRange],
  );

  return (
    <DashboardPeriodContext.Provider value={value}>
      {children}
    </DashboardPeriodContext.Provider>
  );
}

export function useDashboardPeriod(): DashboardPeriodContextValue {
  const ctx = useContext(DashboardPeriodContext);
  if (!ctx) {
    throw new Error('useDashboardPeriod DashboardPeriodProvider içinde kullanılmalıdır');
  }
  return ctx;
}
