import {
  buildSidebarNavSections,
  flattenNavCatalog,
  type NavCatalogContext,
} from '@/lib/nav-match';

/** Kiracı paneli — JWT org kapsamı (`GET /audit-logs`). */
export const TENANT_AUDIT_LOGS_PATH = '/audit-logs';

/** Eski/kısa alias — kiracı sayfasına yönlendirilir. */
export const TENANT_AUDIT_LOGS_ALIAS_PATH = '/audit';

/** Süper admin — platform geneli (`GET /admin/activity`). */
export const ADMIN_PLATFORM_AUDIT_PATH = '/admin/audit-logs';

export function orgHasTenantAuditLogsNav(ctx: NavCatalogContext): boolean {
  const sections = buildSidebarNavSections(ctx);
  const catalog = flattenNavCatalog([
    ...sections.ecommerce,
    ...sections.nativeAccounting,
    ...sections.externalErp,
    ...sections.common,
  ]);
  return catalog.some((item) => item.path === TENANT_AUDIT_LOGS_PATH);
}

/** Admin paneli “Son aktiviteler” kartı — platform özeti için admin rotası. */
export function resolveAdminDashboardAuditHref(): string {
  return ADMIN_PLATFORM_AUDIT_PATH;
}

/** Admin kenar çubuğu — platform denetim kayıtları. */
export function resolveAdminSidebarAuditHref(): string {
  return ADMIN_PLATFORM_AUDIT_PATH;
}

/**
 * Süper admin kiracı denetim sayfasına erişebilir (`/audit-logs` → JWT org).
 * Platform geneli için `/admin/audit-logs` kullanın.
 */
export function resolveSuperAdminTenantAuditHref(
  ctx: NavCatalogContext,
): string | null {
  if (!orgHasTenantAuditLogsNav(ctx)) {
    return null;
  }
  return TENANT_AUDIT_LOGS_PATH;
}
