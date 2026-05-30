import { BREADCRUMB_LABELS } from '@/constants/breadcrumb-routes';
import { formatNavPageContext } from '@/lib/nav-page-context';

const SUPPORT_PATH = '/support';

export function isSupportRoute(pathname: string): boolean {
  return pathname === SUPPORT_PATH || pathname.startsWith(`${SUPPORT_PATH}/`);
}

/** Üst bağlam: «Ortak > Destek» (grup etiketi yoksa yalnızca Destek). */
export function formatSupportNavContext(
  groupLabel: string | undefined,
  supportPageLabel: string,
  leafLabel?: string,
): string {
  return formatNavPageContext(groupLabel, supportPageLabel, leafLabel);
}

/** Alt rota sayfa başlığı; ana `/support` için `undefined`. */
export function resolveSupportSubPageTitle(pathname: string): string | undefined {
  if (!isSupportRoute(pathname) || pathname === SUPPORT_PATH) {
    return undefined;
  }
  if (pathname.startsWith(`${SUPPORT_PATH}/help/`)) {
    return undefined;
  }
  return BREADCRUMB_LABELS[pathname];
}
