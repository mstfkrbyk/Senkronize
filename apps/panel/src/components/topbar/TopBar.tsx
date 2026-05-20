import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Menu, PanelLeft, Search } from 'lucide-react';

import { HelpMenu } from '@/components/topbar/HelpMenu';
import { openCommandPalette } from '@/lib/command-palette';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useSidebar } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { ALL_NAV_ITEMS_FOR_TITLE } from '@/constants/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

function pageTitleFromPath(
  pathname: string,
  t: (key: string) => string,
): string {
  const item = ALL_NAV_ITEMS_FOR_TITLE.find(
    (n) =>
      pathname === n.path ||
      (n.path !== '/' && pathname.startsWith(`${n.path}/`)),
  );
  return item ? t(item.labelKey) : t('common.panel');
}

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

export function TopBar(): ReactElement {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAuth();
  const storeOrg = useAuthStore((s) => s.currentOrg);
  const storeUser = useAuthStore((s) => s.user);
  const logoutStore = useAuthStore((s) => s.logout);
  const setShortcutsHelpOpen = useUiStore((s) => s.setShortcutsHelpOpen);
  const { toggleSidebar, setOpenMobile } = useSidebar();

  const org = data?.organization ?? storeOrg;
  const user = data?.user ?? storeUser;
  const title = pageTitleFromPath(location.pathname, t);

  const handleLogout = async (): Promise<void> => {
    const rt = useAuthStore.getState().refreshToken;
    try {
      if (rt) {
        await api.post('/auth/logout', { refreshToken: rt });
      }
    } catch {
      // Oturum kapatma isteği başarısız olsa bile yerel oturumu sonlandır.
    } finally {
      disconnectSocket();
      logoutStore();
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-ml-1 md:hidden"
        aria-label="Menüyü aç"
        onClick={() => {
          setOpenMobile(true);
        }}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-ml-1 hidden md:inline-flex"
        aria-label="Kenar çubuğunu aç veya kapat"
        onClick={() => {
          toggleSidebar();
        }}
      >
        <PanelLeft className="h-5 w-5" />
      </Button>
      <Separator orientation="vertical" className="mr-1 h-6" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs text-muted-foreground">
          {t('common.location')}
        </span>
        <span className="truncate text-sm font-semibold text-foreground">
          {title}
        </span>
      </div>

      <div className="hidden max-w-xs flex-1 items-center md:flex">
        <Button
          type="button"
          variant="outline"
          className="text-muted-foreground h-9 w-full max-w-xs justify-start gap-2 px-3 font-normal"
          onClick={() => openCommandPalette()}
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{t('common.searchPlaceholder')}</span>
        </Button>
      </div>

      <div className="hidden max-w-xs items-center gap-2 truncate rounded-md border bg-background px-3 py-1.5 text-sm lg:flex">
        {isLoading && !org ? (
          <Skeleton className="h-4 w-40" />
        ) : org ? (
          <>
            <span className="shrink-0 text-muted-foreground">Org</span>
            <span className="truncate font-medium text-foreground">{org.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <HelpMenu />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground"
          aria-label="Klavye kısayolları"
          onClick={() => setShortcutsHelpOpen(true)}
        >
          ?
        </Button>
        <ThemeToggle />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="relative size-9 rounded-full p-0"
            aria-label="Hesap menüsü"
          >
            <Avatar className="size-9 border">
              <AvatarFallback className="text-xs font-medium">
                {user
                  ? initials(user.name, user.email)
                  : isLoading
                    ? '…'
                    : '?'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user?.name ?? 'Kullanıcı'}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/settings')}>
            Profil
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/settings')}>
            Ayarlar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => void handleLogout()}
          >
            Çıkış
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
