import { useEffect } from 'react';

import { useBreadcrumbContext } from '@/contexts/breadcrumb.context';

/** Sayfa detay başlığını breadcrumb son segmentine yazar */
export function useBreadcrumbTail(label: string | undefined): void {
  const { setTailLabel } = useBreadcrumbContext();

  useEffect(() => {
    setTailLabel(label?.trim() ? label.trim() : null);
    return () => {
      setTailLabel(null);
    };
  }, [label, setTailLabel]);
}
