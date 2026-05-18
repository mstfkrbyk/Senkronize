'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { track } from '@/lib/analytics';

/** Fiyatlandırma sayfası görüntülemesi (bir kez). */
export function PricingPageViewTracker(): null {
  const searchParams = useSearchParams();
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) {
      return;
    }
    tracked.current = true;
    const source =
      searchParams.get('src') ??
      searchParams.get('utm_source') ??
      'direct';
    track('pricing_page_viewed', { source });
  }, [searchParams]);

  return null;
}
