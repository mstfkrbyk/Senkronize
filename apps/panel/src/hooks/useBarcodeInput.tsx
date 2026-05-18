import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';

/** Düşük sayı = yüksek öncelik (ör. hızlı arama açıkken stok sayımından önce gelir). */
export const BARCODE_PRIORITY_QUICK_SEARCH = 1;
export const BARCODE_PRIORITY_STOCK_COUNT = 10;

interface Slot {
  priority: number;
  id: string;
  fn: (code: string) => void;
}

interface BarcodeInputContextValue {
  claim: (priority: number, id: string, fn: (code: string) => void) => void;
  release: (id: string) => void;
}

const BarcodeInputContext = createContext<BarcodeInputContextValue | null>(
  null,
);

export function BarcodeInputProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const slotRef = useRef<Slot | null>(null);

  const claim = useCallback(
    (priority: number, id: string, fn: (code: string) => void) => {
      const cur = slotRef.current;
      if (!cur || priority < cur.priority || cur.id === id) {
        slotRef.current = { priority, id, fn };
      }
    },
    [],
  );

  const release = useCallback((id: string) => {
    if (slotRef.current?.id === id) {
      slotRef.current = null;
    }
  }, []);

  useEffect(() => {
    let buf = '';
    let t0 = 0;
    let lastT = 0;
    let maxInterCharGap = 0;

    const reset = (): void => {
      buf = '';
      t0 = 0;
      lastT = 0;
      maxInterCharGap = 0;
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) {
        return;
      }
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const now = Date.now();

      if (e.key === 'Enter') {
        const duration = t0 > 0 ? now - t0 : 0;
        const slot = slotRef.current;
        if (
          slot &&
          buf.length >= 6 &&
          duration > 0 &&
          duration < 1200 &&
          maxInterCharGap <= 100
        ) {
          e.preventDefault();
          slot.fn(buf);
        }
        reset();
        return;
      }

      if (e.key.length !== 1) {
        return;
      }

      if (buf.length > 0) {
        const gap = now - lastT;
        maxInterCharGap = Math.max(maxInterCharGap, gap);
        if (gap > 100) {
          buf = '';
          t0 = now;
          maxInterCharGap = 0;
        }
      } else {
        t0 = now;
        maxInterCharGap = 0;
      }

      buf += e.key;
      lastT = now;
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const value = useMemo(
    () => ({
      claim,
      release,
    }),
    [claim, release],
  );

  return (
    <BarcodeInputContext.Provider value={value}>
      {children}
    </BarcodeInputContext.Provider>
  );
}

export function useBarcodeInputClaim(
  id: string,
  priority: number,
  handler: (code: string) => void,
  enabled: boolean,
): void {
  const ctx = useContext(BarcodeInputContext);

  useEffect(() => {
    if (!ctx || !enabled) {
      return;
    }
    ctx.claim(priority, id, handler);
    return () => {
      ctx.release(id);
    };
  }, [ctx, id, priority, handler, enabled]);
}
