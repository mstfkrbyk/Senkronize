import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { disconnectSocket } from '@/lib/socket';
import { NAV_ITEMS } from '@/constants/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/topbar/NotificationBell';
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
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

function pageTitleFromPath(pathname: string): string {
  const item = NAV_ITEMS.find((n) => n.path === pathname);
  return item?.label ?? 'Panel';
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
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAuth();
  const storeOrg = useAuthStore((s) => s.currentOrg);
  const storeUser = useAuthStore((s) => s.user);
  const logoutStore = useAuthStore((s) => s.logout);

  const org = data?.organization ?? storeOrg;
  const user = data?.user ?? storeUser;
  const title = pageTitleFromPath(location.pathname);

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
      <SidebarTrigger className="-ml-1 text-foreground" />
      <Separator orientation="vertical" className="mr-1 h-6" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs text-muted-foreground">Konum</span>
        <span className="truncate text-sm font-semibold text-foreground">
          {title}
        </span>
      </div>

      <div className="hidden max-w-xs items-center gap-2 truncate rounded-md border bg-background px-3 py-1.5 text-sm md:flex">
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
        <div className="md:hidden">
          <NotificationBell />
        </div>
        <ThemeToggle />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="relative size-9 rounded-full p-0"
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
