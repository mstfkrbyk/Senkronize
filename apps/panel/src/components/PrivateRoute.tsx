import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { PageLoader } from '@/components/PageLoader';
import { useAuth } from '@/hooks/useAuth';
import { resolveAppHomePath } from '@/lib/app-home';
import { useImpersonationStore } from '@/store/impersonation.store';
import { useAuthStore } from '@/store/auth.store';

export function PrivateRoute(): ReactElement {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const { data: me, isPending, isError } = useAuth();
  const isImpersonating = useImpersonationStore((s) => s.isImpersonating);

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
  const isOnboardingRoute =
    location.pathname === '/onboarding' ||
    location.pathname.startsWith('/onboarding/');
  if (!onboardingDone && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }
  if (onboardingDone && isOnboardingRoute) {
    return (
      <Navigate
        to={resolveAppHomePath({
          type: me.organization.type,
          orgProducts: me.organization.orgProducts,
          isImpersonating: isImpersonating || me.isImpersonating,
          accountingMode: me.organization.accountingMode,
        })}
        replace
      />
    );
  }

  return <Outlet />;
}
