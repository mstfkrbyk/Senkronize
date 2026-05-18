import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { PageLoader } from '@/components/PageLoader';
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
      <div className="bg-background flex min-h-screen items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  if (isError || !me) {
    return <Navigate to="/login" replace />;
  }

  const onboardingDone =
    me.organization.onboardingCompleted || me.user.role === 'SUPER_ADMIN';
  if (!onboardingDone && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  if (onboardingDone && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
