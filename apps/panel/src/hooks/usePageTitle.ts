import { useEffect } from 'react';

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} — Senkronize` : 'Senkronize';
    return (): void => {
      document.title = 'Senkronize';
    };
  }, [title]);
}
