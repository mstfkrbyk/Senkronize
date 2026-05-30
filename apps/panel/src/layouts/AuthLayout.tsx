import type { ReactElement } from 'react';
import { Outlet } from 'react-router-dom';

import { PageTransition } from '@/components/PageTransition';

export function AuthLayout(): ReactElement {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4 sm:p-6">
      <div className="mb-6 text-center">
        <p className="text-xl font-semibold tracking-tight text-foreground">Senkronize</p>
        <p className="text-sm text-muted-foreground">
          Pazaryeri ve stok yönetim paneli
        </p>
      </div>
      <div className="w-full max-w-2xl">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </div>
    </div>
  );
}
