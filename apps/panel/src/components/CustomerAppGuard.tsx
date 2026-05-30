import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';
import { useImpersonationStore } from '@/store/impersonation.store';

/** Müşteri paneli — DIRECT org veya partner impersonation. */
export function CustomerAppGuard(): ReactElement {
  const { data: me } = useAuth();
  const isImpersonating = useImpersonationStore((s) => s.isImpersonating);

  if (!me) {
    return <Outlet />;
  }

  const impersonating = isImpersonating || me.isImpersonating;

  if (me.organization.type === 'PARTNER' && !impersonating) {
    return <Navigate to="/partner" replace />;
  }

  return <Outlet />;
}
