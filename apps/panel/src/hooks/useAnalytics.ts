import * as Sentry from '@sentry/react';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { identifyUser, resetAnalytics, trackPageView } from '@/lib/analytics';
import { useAuthStore } from '@/store/auth.store';

/** Sayfa yükleme süresi izleme */
export function trackPageLoad(pageName: string, duration: number): void {
  if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) {
    return;
  }
  Sentry.metrics.distribution('page_load', duration, {
    unit: 'millisecond',
    attributes: { page: pageName },
  });
}

/** API hata izleme */
export function trackApiError(endpoint: string, status: number): void {
  if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) {
    return;
  }
  Sentry.metrics.count('api_error', 1, {
    attributes: { endpoint, status: String(status) },
  });
}

/** Route değişiminde sayfa görüntüleme; oturumda kullanıcı kimliği / çıkışta sıfırlama. */
export function useAnalytics(): void {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const lastTrackedPath = useRef<string>('');
  const navigationStart = useRef<number>(performance.now());

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (path === lastTrackedPath.current) {
      return;
    }
    const duration = performance.now() - navigationStart.current;
    if (lastTrackedPath.current) {
      trackPageLoad(lastTrackedPath.current, duration);
    }
    navigationStart.current = performance.now();
    lastTrackedPath.current = path;
    trackPageView(path);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!import.meta.env.VITE_POSTHOG_KEY) {
      return;
    }
    if (user && currentOrg) {
      identifyUser(user.id, {
        orgId: currentOrg.id,
        plan: currentOrg.plan,
      });
    } else {
      resetAnalytics();
    }
  }, [user, currentOrg]);
}
