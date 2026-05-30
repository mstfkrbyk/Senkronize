/** Eski `/stock/*` rotalarını birleşik ürün paneline yönlendirir. */
export function resolveStockLegacyRedirect(pathname: string): string | null {
  if (pathname === '/stock') {
    return '/products?tab=status';
  }
  if (pathname === '/stock/warehouses') {
    return '/products?tab=warehouses';
  }
  if (pathname === '/stock/movements') {
    return '/products?tab=movements';
  }
  if (pathname === '/stock/transfers') {
    return '/products?tab=transfers';
  }
  if (pathname === '/stock/forecast') {
    return '/products?tab=forecast';
  }
  if (pathname === '/stock/distribution') {
    return '/products?tab=status';
  }
  if (pathname === '/stock/count') {
    return '/products/count';
  }
  if (pathname === '/stock/count/scan') {
    return '/products/count/scan';
  }
  if (pathname.startsWith('/stock/transfers/')) {
    return pathname.replace('/stock/transfers', '/products/transfers');
  }
  return null;
}
