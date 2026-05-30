import type { NavGroupId } from '@/constants/navigation';

export const ERP_SETUP_PATH = '/connections/erp/setup';

const ERP_CONNECTION_DETAIL_PATH = /^\/connections\/erp\/[^/]+$/;

export function isErpSetupPath(pathname: string): boolean {
  return pathname === ERP_SETUP_PATH;
}
const MARKETPLACE_CONNECTION_DETAIL_PATH = /^\/connections\/(?!erp(?:\/|$))[^/]+$/;

export function isErpConnectionDetailPath(pathname: string): boolean {
  if (isErpSetupPath(pathname)) return false;
  return ERP_CONNECTION_DETAIL_PATH.test(pathname);
}

export function isMarketplaceConnectionDetailPath(pathname: string): boolean {
  return MARKETPLACE_CONNECTION_DETAIL_PATH.test(pathname);
}

export function isConnectionDetailPath(pathname: string): boolean {
  return (
    isErpConnectionDetailPath(pathname) || isMarketplaceConnectionDetailPath(pathname)
  );
}

export function resolveConnectionDetailNavGroup(
  pathname: string,
): NavGroupId | undefined {
  if (isErpSetupPath(pathname)) {
    return 'externalErp';
  }
  if (isErpConnectionDetailPath(pathname)) {
    return 'externalErp';
  }
  return undefined;
}
