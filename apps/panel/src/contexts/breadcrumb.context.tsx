import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

interface BreadcrumbContextValue {
  tailLabel: string | null;
  setTailLabel: (label: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [tailLabel, setTailLabelState] = useState<string | null>(null);

  const setTailLabel = useCallback((label: string | null): void => {
    setTailLabelState(label);
  }, []);

  const value = useMemo(
    () => ({ tailLabel, setTailLabel }),
    [tailLabel, setTailLabel],
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbContext(): BreadcrumbContextValue {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error('useBreadcrumbContext BreadcrumbProvider içinde kullanılmalıdır');
  }
  return ctx;
}
