import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  Handshake,
  History,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Shield,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { PageTransition } from '@/components/PageTransition';
import { Badge } from '@/components/ui/badge';
import { ADMIN_PLATFORM_AUDIT_PATH } from '@/lib/admin-audit-nav';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { adminOrgDetailUrl } from '@/lib/admin-org-detail-nav';
import { cn } from '@/lib/utils';
import { usePendingPartnerLinkCount } from '@/pages/partner/hooks/usePartnerLink';

interface AdminNavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
  badgeKey?: 'partnerLinks';
}

const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', labelKey: 'admin.nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/organizations', labelKey: 'admin.nav.organizations', icon: Building2 },
  { to: '/admin/users', labelKey: 'admin.nav.users', icon: Users },
  { to: '/admin/partners', labelKey: 'admin.nav.partners', icon: Handshake },
  {
    to: '/admin/partner-link-requests',
    labelKey: 'admin.nav.partnerLinks',
    icon: Link2,
    badgeKey: 'partnerLinks',
  },
  { to: '/admin/subscriptions', labelKey: 'admin.nav.subscriptions', icon: CreditCard },
  { to: '/admin/tickets', labelKey: 'admin.nav.tickets', icon: LifeBuoy },
  { to: ADMIN_PLATFORM_AUDIT_PATH, labelKey: 'admin.nav.auditLogs', icon: History },
  { to: '/admin/integrations', labelKey: 'admin.nav.integrations', icon: Activity },
  { to: '/admin/security', labelKey: 'admin.nav.security', icon: Shield },
];

export function AdminLayout(): ReactElement {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: pendingLinkCount = 0, refetch: refetchPendingLinkCount } =
    usePendingPartnerLinkCount();

  const { data: platformOrg } = useQuery({
    queryKey: ['admin', 'platform-organization'],
    queryFn: async (): Promise<{ id: string; name: string; slug: string } | null> => {
      const { data } = await api.get<{ id: string; name: string; slug: string } | null>(
        '/admin/organizations/platform',
      );
      return data;
    },
    staleTime: 300_000,
  });

  useEffect(() => {
    void refetchPendingLinkCount();
  }, [location.pathname, refetchPendingLinkCount]);

  const navLinkClass = (isActive: boolean): string =>
    cn(
      'flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 md:shrink',
      isActive
        ? 'bg-white/10 text-white'
        : 'text-slate-300 hover:bg-white/5 hover:text-white',
    );

  return (
    <div className="flex min-h-svh flex-col bg-slate-100 md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-sidebar-border bg-slate-900 text-sidebar-foreground md:w-56 md:border-b-0 md:border-r">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-sky-400" aria-hidden />
            <span className="font-semibold tracking-tight">{t('admin.layout.title')}</span>
          </div>
          <Badge className="mt-2 border-0 bg-red-600 text-white hover:bg-red-600">
            {t('admin.layout.badge')}
          </Badge>
          {platformOrg ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full border-sky-500/50 bg-slate-800 text-sky-100 hover:bg-slate-700 hover:text-white"
              asChild
            >
              <NavLink to={adminOrgDetailUrl(platformOrg.id, 'settings')}>
                {t('admin.layout.platformOrgLink')}
              </NavLink>
            </Button>
          ) : null}
        </div>
        <nav
          className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3 md:flex md:flex-1 md:flex-col md:overflow-y-auto"
          aria-label={t('admin.layout.title')}
        >
          {ADMIN_NAV.map(({ to, labelKey, icon: Icon, end, badgeKey }) => {
            const showBadge =
              badgeKey === 'partnerLinks' && pendingLinkCount > 0;
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
                {showBadge ? (
                  <Badge className="h-5 min-w-5 shrink-0 justify-center border-0 bg-sky-500 px-1.5 text-xs text-white hover:bg-sky-500">
                    {pendingLinkCount > 99 ? '99+' : pendingLinkCount}
                  </Badge>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-2">
          <Button
            asChild
            variant="ghost"
            className="min-h-11 w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <NavLink to="/dashboard">{t('admin.layout.backToPanel')}</NavLink>
          </Button>
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
