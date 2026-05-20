import type { ReactElement } from 'react';
import { Outlet } from 'react-router-dom';

export function AuthLayout(): ReactElement {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full">
        <Outlet />
      </div>
    </div>
  );
}
