import type { ReactElement } from 'react';
import { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileBarChart,
  Handshake,
  LayoutDashboard,
  LogOut,
  Palette,
  Percent,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { PageTransition } from '@/components/PageTransition';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  formatPartnerNavContext,
  partnerPortalLabel,
  resolvePartnerSubPageTitle,
} from '@/lib/partner-nav-context';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { syncAuthStoreFromMe } from '@/lib/sync-auth-from-me';
import { disconnectSocket } from '@/lib/socket';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import type { OrgPlanTier } from '@/types/auth';

import {
  PARTNER_COMMISSION_PATH,
  PARTNER_COMMISSION_REPORT_PATH,
  PARTNER_COMMISSION_REPORT_SEARCH,
  isPartnerCommissionNavActive,
} from './partner-commission-routes';

interface PartnerNavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
  search?: string;
}

const PARTNER_NAV: PartnerNavItem[] = [
  { to: '/partner', labelKey: 'partner.nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/partner/clients', labelKey: 'partner.nav.clients', icon: Users },
  { to: PARTNER_COMMISSION_PATH, labelKey: 'partner.nav.commission', icon: Percent, end: true },
  {
    to: PARTNER_COMMISSION_REPORT_PATH,
    labelKey: 'partner.nav.commissionReport',
    icon: FileBarChart,
    search: PARTNER_COMMISSION_REPORT_SEARCH,
  },
  { to: '/partner/performance', labelKey: 'partner.nav.performance', icon: BarChart3 },
  { to: '/partner/onboarding', labelKey: 'partner.nav.onboarding', icon: UserPlus },
  { to: '/partner/white-label', labelKey: 'partner.nav.whiteLabel', icon: Palette },
];

const PLAN_RANK: Record<OrgPlanTier, number> = {
  BASLANGIC: 0,
  GELISIM: 1,
  PRO: 2,
  KURUMSAL: 3,
};

function initials(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed.length > 0) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const APP_NAME = 'Senkronize';

export function PartnerLayout(): ReactElement {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const storeUser = useAuthStore((s) => s.user);
  const storeOrg = useAuthStore((s) => s.currentOrg);
  const logoutStore = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!me) {
      return;
    }
    syncAuthStoreFromMe(me);
  }, [me]);

  const user = me?.user ?? storeUser;
  const org = me?.organization ?? storeOrg;
  const portalLabel = partnerPortalLabel(t);
  const partnerSubPageTitle = resolvePartnerSubPageTitle(pathname, t);
  const partnerContextLine = formatPartnerNavContext(partnerSubPageTitle, t);

  useEffect(() => {
    const leaf = partnerSubPageTitle;
    document.title = leaf
      ? `${leaf} | ${portalLabel} | ${APP_NAME}`
      : `${portalLabel} | ${APP_NAME}`;
    return (): void => {
      document.title = APP_NAME;
    };
  }, [partnerSubPageTitle, portalLabel]);
  const plan = org?.plan;
  const showKurumsalUpsell =
    plan != null && PLAN_RANK[plan] < PLAN_RANK.GELISIM;

  const handleLogout = async (): Promise<void> => {
    const rt = useAuthStore.getState().refreshToken;
    try {
      if (rt) {
        await api.post('/auth/logout', { refreshToken: rt });
      }
    } catch {
      // Yerel oturumu yine de kapat.
    } finally {
      disconnectSocket();
      logoutStore();
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  };

  const navLinkClass = (isActive: boolean): string =>
    cn(
      'flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 md:shrink md:snap-align-none',
      isActive
        ? 'bg-white/10 text-white'
        : 'text-slate-300 hover:bg-white/5 hover:text-white',
    );

  return (
    <div className="flex min-h-svh flex-col bg-slate-100 md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-sidebar-border bg-slate-900 text-sidebar-foreground md:w-56 md:border-b-0 md:border-r">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <Handshake className="size-5 text-sky-400" aria-hidden />
            <span className="font-semibold tracking-tight">{t('partner.layout.title')}</span>
          </div>
          <Badge className="mt-2 border-0 bg-sky-500 text-white hover:bg-sky-500">
            {t('partner.layout.badge')}
          </Badge>
        </div>
        <nav
          className="flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain scroll-smooth p-2 pb-3 [-ms-overflow-style:none] [scrollbar-width:thin] md:snap-none md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto md:pb-2 [&::-webkit-scrollbar]:h-1.5"
          aria-label={t('partner.layout.navAria')}
        >
          {PARTNER_NAV.map(({ to, labelKey, icon: Icon, end, search }) => {
            const commissionNav =
              to === PARTNER_COMMISSION_PATH ||
              to === PARTNER_COMMISSION_REPORT_PATH;
            const linkTo = search ? { pathname: to, search } : to;

            return (
            <NavLink
              key={to}
              to={linkTo}
              end={end}
              className={({ isActive }) =>
                navLinkClass(
                  commissionNav
                    ? isPartnerCommissionNavActive(to, pathname)
                    : isActive,
                )
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{t(labelKey)}</span>
            </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{partnerContextLine}</p>
            <p className="truncate text-sm font-medium text-slate-900">
              {org?.name ?? portalLabel}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground sm:truncate sm:line-clamp-none">
              {t('partner.layout.hint')}
            </p>
          </div>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 shrink-0 gap-2 self-end px-2 sm:self-center"
                  aria-label={t('partner.layout.accountMenuAria')}
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {initials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[min(140px,30vw)] truncate text-sm sm:inline">
                    {user.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <NavLink to="/dashboard" className="cursor-pointer">
                    <LayoutDashboard className="mr-2 size-4" aria-hidden />
                    {t('partner.layout.backToDashboard')}
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 size-4" aria-hidden />
                    {t('partner.layout.settings')}
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="mr-2 size-4" aria-hidden />
                  {t('partner.layout.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </header>
          <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          <PageTransition>
            {showKurumsalUpsell ? (
              <UpgradePrompt
                feature={t('partner.layout.kurumsalUpsell.feature')}
                requiredPlan="KURUMSAL"
                currentPlan={plan}
                description={t('partner.layout.kurumsalUpsell.description')}
                className="mb-6"
              />
            ) : null}
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
