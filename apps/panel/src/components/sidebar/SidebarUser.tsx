import type { ReactElement } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

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

export function SidebarUser(): ReactElement {
  const { data, isLoading } = useAuth();
  const storeUser = useAuthStore((s) => s.user);

  const user = data?.user ?? storeUser;

  if (isLoading && !user) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-1 flex-col gap-1 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-2 py-1.5 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
        Oturum bilgisi yok
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <Avatar className="size-9 border border-sidebar-border">
        <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
          {initials(user.name, user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <p className="truncate text-sm font-medium text-sidebar-foreground">
          {user.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}
