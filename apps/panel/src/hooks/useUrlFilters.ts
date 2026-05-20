import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.join(',') === b.join(',');
  }
  return a === b;
}

function parseUrlValue(raw: string, defaultValue: unknown): unknown {
  if (typeof defaultValue === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }
  if (typeof defaultValue === 'boolean') {
    return raw === 'true';
  }
  if (Array.isArray(defaultValue)) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return raw;
}

function serializeUrlValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(',');
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

export function useUrlFilters<T extends Record<string, unknown>>(
  defaults: T,
): [T, (updates: Partial<T>) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo((): T => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const param = searchParams.get(String(key));
      if (param !== null) {
        result[key] = parseUrlValue(param, defaults[key]) as T[keyof T];
      }
    }
    return result;
  }, [searchParams, defaults]);

  const setValues = useCallback(
    (updates: Partial<T>): void => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            const defaultVal = defaults[key as keyof T];
            if (isEmptyValue(value) || valuesEqual(value, defaultVal)) {
              next.delete(key);
            } else {
              next.set(key, serializeUrlValue(value));
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [defaults, setSearchParams],
  );

  const reset = useCallback((): void => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return [values, setValues, reset];
}
