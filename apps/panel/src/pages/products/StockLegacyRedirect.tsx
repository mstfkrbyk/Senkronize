import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { resolveStockLegacyRedirect } from './stock-legacy-redirect';

export function StockLegacyRedirect(): ReactElement {
  const { pathname, search } = useLocation();
  const target = resolveStockLegacyRedirect(pathname);

  if (!target) {
    return <Navigate to="/products?tab=status" replace />;
  }

  const [base, query = ''] = target.split('?');
  const nextSearch = new URLSearchParams(query);
  const currentSearch = new URLSearchParams(search);
  for (const [key, value] of currentSearch.entries()) {
    if (!nextSearch.has(key)) {
      nextSearch.set(key, value);
    }
  }
  const merged = nextSearch.toString();
  return <Navigate to={merged ? `${base}?${merged}` : base} replace />;
}
