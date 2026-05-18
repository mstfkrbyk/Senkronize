import type { ReactElement, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: ReactNode;
}

export function SuperAdminRoute({ children }: Props): ReactElement {
  const { data: me, isPending, isError } = useAuth();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2
          className="h-8 w-8 animate-spin text-muted-foreground"
          aria-label="Yükleniyor"
        />
      </div>
    );
  }

  if (isError || !me || me.user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
