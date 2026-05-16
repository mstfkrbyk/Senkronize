import type { ReactElement } from 'react';
import { Outlet } from 'react-router-dom';

export function AuthLayout(): ReactElement {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
