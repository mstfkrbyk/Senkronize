import type { ReactElement } from 'react';

export function OrdersPage(): ReactElement {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">
        Siparişler
      </h1>
      <p className="text-muted-foreground">Yapım aşamasında</p>
    </div>
  );
}
