import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export function PrivateRoute(): ReactElement {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const { data: me, isPending, isError } = useAuth();

  if (!token) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2
          className="h-8 w-8 animate-spin text-muted-foreground"
          aria-label="Yükleniyor"
        />
      </div>
    );
  }

  if (isError || !me) {
    return <Navigate to="/login" replace />;
  }

  const onboardingDone = me.organization.onboardingCompleted;
  if (!onboardingDone && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  if (onboardingDone && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
