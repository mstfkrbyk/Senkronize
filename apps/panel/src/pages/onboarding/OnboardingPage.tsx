import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ONBOARDING_WIZARD_PATH } from '@/pages/onboarding/onboarding-nav-context';

/**
 * Kurulum kök sayfası (sihirbaz değil).
 * `/onboarding` → `/onboarding/wizard`; sihirbaz alt rotada `<Outlet />` ile render edilir.
 * Üst bağlam «Ortak > Kurulum» — `formatOnboardingRootNavContext` / sihirbaz adım satırı.
 */
export function OnboardingPage(): ReactElement {
  const location = useLocation();

  if (location.pathname === '/onboarding' || location.pathname === '/onboarding/') {
    return <Navigate to={ONBOARDING_WIZARD_PATH} replace />;
  }

  return <Outlet />;
}
