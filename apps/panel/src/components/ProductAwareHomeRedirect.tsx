import type { ReactElement, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { resolveAppHomePath } from '@/lib/app-home';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonationStore } from '@/store/impersonation.store';
import { useAuthStore } from '@/store/auth.store';

/** `/` veya layout index → org tipine ve ürün hattına göre ana sayfa. */
export function ProductAwareHomeRedirect(): ReactElement {
  const { data: me } = useAuth();
  const storeOrg = useAuthStore((s) => s.currentOrg);
  const isImpersonating = useImpersonationStore((s) => s.isImpersonating);
  const { mode: resolvedAccountingMode } = useAccountingMode();

  const org = me?.organization ?? storeOrg;
  const impersonating = isImpersonating || Boolean(me?.isImpersonating);
  const accountingMode =
    me?.organization.accountingMode ??
    storeOrg?.accountingMode ??
    resolvedAccountingMode;

  return (
    <Navigate
      to={resolveAppHomePath({
        type: org?.type,
        orgProducts: org?.orgProducts,
        isImpersonating: impersonating,
        accountingMode,
      })}
      replace
    />
  );
}

interface ProductAwareDashboardGateProps {
  children: ReactNode;
}

/** Sadece ACCOUNTING org'da `/dashboard` entegrasyon paneli yerine ön muhasebe CTA. */
export function ProductAwareDashboardGate({
  children,
}: ProductAwareDashboardGateProps): ReactElement {
  return <>{children}</>;
}
