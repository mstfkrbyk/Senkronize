import { useMemo, type ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';

import { useSidebar } from '@/components/ui/sidebar';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import {
  buildMobileNavEntries,
  MOBILE_BOTTOM_NAV_GRID_COLS,
  type MobileNavEntry,
} from '@/lib/mobile-bottom-nav';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useImpersonationStore } from '@/store/impersonation.store';

interface NavLinkItemProps {
  path: string;
  search?: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

function NavLinkItem({
  path,
  search,
  icon: Icon,
  label,
  end,
}: NavLinkItemProps): ReactElement {
  const to = search ? { pathname: path, search } : path;

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'mx-0.5 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground',
          isActive && 'bg-primary/10 text-primary',
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="max-w-full truncate text-center leading-tight">{label}</span>
    </NavLink>
  );
}

interface MenuButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

function MenuButton({ icon: Icon, label, onClick }: MenuButtonProps): ReactElement {
  return (
    <button
      type="button"
      className="mx-0.5 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      onClick={onClick}
      aria-label={label}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="max-w-full truncate text-center leading-tight">{label}</span>
    </button>
  );
}

export function MobileBottomNav(): ReactElement {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  const isImpersonating = useImpersonationStore((s) => s.isImpersonating);
  const { mode } = useAccountingMode();

  const navCtx = useMemo(
    () => ({ orgProducts, orgType, accountingMode: mode, isImpersonating }),
    [orgProducts, orgType, mode, isImpersonating],
  );

  const entries = useMemo(
    () => buildMobileNavEntries(navCtx),
    [navCtx],
  );

  const colClass =
    MOBILE_BOTTOM_NAV_GRID_COLS[entries.length] ?? 'grid-cols-5';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)]"
      aria-label={t('nav.bottomNavAria')}
    >
      <div className={cn('grid h-16', colClass)}>
        {entries.map((entry: MobileNavEntry) => {
          if (entry.kind === 'menu') {
            const Icon = entry.icon;
            const label = t(entry.labelKey);
            return (
              <MenuButton
                key="menu"
                icon={Icon}
                label={label}
                onClick={() => {
                  setOpenMobile(true);
                }}
              />
            );
          }

          const Icon = entry.icon;
          const label = t(entry.labelKey);
          const key = `${entry.path}${entry.search ?? ''}`;

          return (
            <NavLinkItem
              key={key}
              path={entry.path}
              search={entry.search}
              icon={Icon}
              label={label}
              end={entry.end}
            />
          );
        })}
      </div>
    </nav>
  );
}
