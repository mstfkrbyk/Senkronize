import type { ReactElement, ReactNode } from 'react';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

import { resolveAppHomePath } from '@/lib/app-home';
import { resolveOrgHomePath } from '@/lib/org-products';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonationStore } from '@/store/impersonation.store';

interface Props {
  children: ReactNode;
}

export function PartnerRoute({ children }: Props): ReactElement {
  const { data: me, isPending, isError } = useAuth();
  const isImpersonating = useImpersonationStore((s) => s.isImpersonating);
  const stopImpersonation = useImpersonationStore((s) => s.stopImpersonation);

  const localOnlyImpersonation =
    isImpersonating && !isPending && (isError || !me?.isImpersonating);

  useEffect(() => {
    if (!localOnlyImpersonation) {
      return;
    }
    stopImpersonation();
    toast.error(
      isError
        ? 'Müşteri oturumu doğrulanamadı. Lütfen tekrar deneyin.'
        : 'Müşteri hesabına geçilemedi.',
    );
  }, [isError, localOnlyImpersonation, stopImpersonation]);

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-100">
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

  const impersonating = isImpersonating || me.isImpersonating;

  if (impersonating) {
    if (isImpersonating && !me.isImpersonating) {
      return (
        <div className="flex min-h-svh items-center justify-center bg-slate-100">
          <Loader2
            className="h-8 w-8 animate-spin text-muted-foreground"
            aria-label="Müşteri paneline geçiliyor"
          />
        </div>
      );
    }

    return (
      <Navigate
        to={resolveOrgHomePath(
          me.organization.orgProducts,
          undefined,
          me.organization.accountingMode,
        )}
        replace
      />
    );
  }

  if (me.organization.type !== 'PARTNER') {
    return (
      <Navigate
        to={resolveAppHomePath({
          type: me.organization.type,
          orgProducts: me.organization.orgProducts,
          isImpersonating: false,
          accountingMode: me.organization.accountingMode,
        })}
        replace
      />
    );
  }

  return <>{children}</>;
}
