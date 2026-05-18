import * as Sentry from '@sentry/react';
import { useEffect } from 'react';

import { useAuthStore } from '@/store/auth.store';

export function useSentryUser(): void {
  const user = useAuthStore((s) => s.user);
  const currentOrg = useAuthStore((s) => s.currentOrg);

  useEffect(() => {
    if (!import.meta.env.VITE_SENTRY_DSN) {
      return;
    }
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email });
      if (currentOrg?.id) {
        Sentry.setTag('organizationId', currentOrg.id);
      }
    } else {
      Sentry.setUser(null);
      Sentry.setTag('organizationId', '');
    }
  }, [user, currentOrg]);
}
