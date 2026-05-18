import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { identifyUser, resetAnalytics, trackPageView } from '@/lib/analytics';
import { useAuthStore } from '@/store/auth.store';

/** Route değişiminde sayfa görüntüleme; oturumda kullanıcı kimliği / çıkışta sıfırlama. */
export function useAnalytics(): void {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const lastTrackedPath = useRef<string>('');

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (path === lastTrackedPath.current) {
      return;
    }
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
