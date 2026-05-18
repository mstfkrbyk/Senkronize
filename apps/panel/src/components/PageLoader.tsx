import type { ReactElement } from 'react';

export function PageLoader(): ReactElement {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">Yükleniyor...</p>
      </div>
    </div>
  );
}
