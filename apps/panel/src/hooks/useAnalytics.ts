import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { resetAnalytics, trackPageView } from '@/lib/analytics';
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

export function useAnalytics(): {
  identify: (userId: string, orgId: string, plan: string) => void;
  track: (event: string, properties?: object) => void;
} {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const lastTrackedPath = useRef<string>('');
  const navigationStart = useRef<number>(performance.now());

  const identify = useCallback(
    (userId: string, orgId: string, plan: string): void => {
      if (!import.meta.env.VITE_POSTHOG_KEY) {
        return;
      }
      posthog.identify(userId, { orgId, plan });
      posthog.group('organization', orgId, { plan });
    },
    [],
  );

  const track = useCallback((event: string, properties?: object): void => {
    if (!import.meta.env.VITE_POSTHOG_KEY) {
      return;
    }
    posthog.capture(event, properties);
  }, []);

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
      identify(user.id, currentOrg.id, currentOrg.plan);
    } else {
      resetAnalytics();
    }
  }, [user, currentOrg, identify]);

  return { identify, track };
}
