'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { type ReactElement, type ReactNode, Suspense, useEffect } from 'react';

import {
  captureMarketingPageView,
  initMarketingAnalytics,
} from '@/lib/analytics';
import { getSiteUrl } from '@/lib/site-url';

function PostHogPageViews(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initMarketingAnalytics();
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      return;
    }
    const site = getSiteUrl().replace(/\/$/, '');
    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    captureMarketingPageView(`${site}${path.startsWith('/') ? path : `/${path}`}`);
  }, [pathname, searchParams]);

  return null;
}

interface Props {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: Props): ReactElement {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageViews />
      </Suspense>
      {children}
    </>
  );
}
